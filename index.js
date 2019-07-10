require('dotenv').config()

const moment = require('moment')

const { createMessageAdapter } = require('@slack/interactive-messages')
const slackInteractions = createMessageAdapter(process.env.SLACK_SIGNING_SECRET)

const { WebClient } = require('@slack/web-api');


const Trello = require("trello");
const trello = new Trello(process.env.TRELLO_API_KEY, process.env.TRELLO_OAUTH_TOKEN)

const xls = require('excel4node')

const express = require('express')
const request = require('request-promise')
const app = express()

const sqlite3 = require('sqlite3').verbose();
let db;

function createDb() {
    db = new sqlite3.Database(
        process.env.DB_INSANE_FOLDER ? 'db/botCollectorAuth.sqlite3' : "/db/botCollectorAuth.sqlite3", 
        createTable);
}


function createTable() {
    db.run("CREATE TABLE IF NOT EXISTS auth (team_id TEXT PRIMARY KEY, resp TEXT)");
}


app.get('/trellocollector/complete', function (req, res) {
    const oauthURL = `https://slack.com/api/oauth.access?client_id=${process.env.SLACK_APP_CLIENT_ID}&client_secret=${process.env.SLACK_APP_CLIENT_SECRET}&code=${req.query.code}`;
    console.log('oauth URL', oauthURL)
    request({
        url: oauthURL,
        json: true,
    }).then((response) => {
        if(!response.ok) {
            res.send(`Error installing bot ${response.error}`)
        } else {
            db.run(`INSERT INTO auth(team_id,resp) VALUES(?,?)`, [response.team_id, JSON.stringify(response)])
            res.send(`Bot installed under your team: ${response.team_name} `)
        }
        // console.log('tokens response', response);
        
    }).catch((error) => {
        res.send(`Error caught installing bot ${error}`)
    })
    
})

app.use('/trellocollector', slackInteractions.expressMiddleware())

slackInteractions.action('month_report', async (payload, respond) => {
    sendMonthReport(payload, respond)
})

slackInteractions.action('prev_month_report', async (payload, respond) => {
    sendMonthReport(payload, respond)
})

function getCredentialsFromDB(id) {
    return new Promise((resolve, reject) => 
        db.get("SELECT resp \
            FROM auth WHERE team_id = ?", [id], 
            (err, row) => {
                if (err) {
                    reject(err.message);
                } else {
                    resolve(JSON.parse(row.resp))
                }
            }
        )
    )
}

async function sendMonthReport(payload, respond) {
    respond({text: 'Collecting data...'})
    console.log('Received a command', payload)
    let db_resp;
    try {
        db_resp = await getCredentialsFromDB(payload.team.id);
    } catch (err) {
        console.log(err);
        respond({text: 'Unexpected error occured :('})
        return {}
    }

    const slackApp = new WebClient(db_resp.access_token)
    const slackBot = new WebClient(db_resp.bot_access_token)

    let actual_callback_id = payload.callback_id
    if (payload.type == 'interactive_message') {
        actual_callback_id = payload.actions[0].value
    }
    const report = await getMonthReport(actual_callback_id).catch(console.error)
    const xlsReport = await convertReportToXls(report.items).catch(console.error)
    await slackBot.files.upload({
        channels: payload.channel.id,
        file: xlsReport.file,
        filetype: 'xlsx',
        filename: `Report${report.startRange.format("DD.MM.YYYY")}-${report.endRange.format("DD.MM.YYYY")}.xlsx`,
        title: `Report${report.startRange.format("DD.MM.YYYY")}-${report.endRange.format("DD.MM.YYYY")}.xlsx`
    }).catch(console.error)

    await slackApp.chat.postMessage({
        channel: payload.channel.id,
        text: `Report for ${report.startRange.format("DD.MM.YYYY")}-${report.endRange.format("DD.MM.YYYY")}:\n\
         Incomes: *${xlsReport.totalIncome.toFixed(2)}*\n\
         Expenses: *${xlsReport.totalExpense.toFixed(2)}*\n\
         Total: *${xlsReport.total.toFixed(2)}*\n`
    }).catch(console.error)

    await slackApp.chat.postMessage({
        channel: payload.channel.id,
        attachments: [
            {
                "fallback": "",
                "callback_id": "month_report",
                "color": "#3AA3E3",
                "attachment_type": "default",
                "actions": [
                    {
                        "name": "month_report",
                        "text": "Current month report",
                        "type": "button",
                        "value": "month_report"
                    },
                    {
                        "name": "prev_month_report",
                        "text": "Previous month report",
                        "type": "button",
                        "value": "prev_month_report"
                    }
                ]
            }
        ]
    }).catch(console.error)
}

async function getMonthReport(action_id) {
    let cards = await trello.getCardsOnBoard(process.env.TRELLO_BOARD_ID).catch(console.error)
    let cards_action_promises = cards.map(card => trello.makeRequest('get', '/1/cards/' + card.id + '/actions', { webhooks: true }))
    let cards_action = await Promise.all(cards_action_promises).catch(console.error)
    let card_comments = []

    cards_action = cards_action.reduce((acc, val) => acc.concat(val), [])
    let comments = cards_action.filter(a => a.type == 'commentCard')

    let currentDate = moment()
    
    if (action_id == 'prev_month_report')
        currentDate = currentDate.subtract(1, 'months');

    let endRange = currentDate.clone()
    endRange.date(1).add(process.env.REPORT_MONTH_OFFSET_IN_DAYS, 'days').subtract(1, 'days')
    let startRange = currentDate.clone()
    startRange.subtract(1, 'months').date(1).add(process.env.REPORT_MONTH_OFFSET_IN_DAYS, 'days')

    let searchMonthComments = comments.filter(c => moment(c.date) > startRange && moment(c.date) < endRange)
    
    let items = [];
    for(comment of searchMonthComments) {
        // console.log("comment", comment)
        let regex = /(?<income>\+?)(\s*)(?<name>.+?)\s*[-=]\s*(?<price>\d+[.:,]?\d*)(\s*x\s*)?(?<count>\d+)?/
        let lines = comment.data.text.split('\n')
        let matches = lines.map(l => regex.exec(l))
        matches = matches.filter(m => m != null|| m != undefined).map(m => m.groups)
        matches.forEach(m => {
            // m.liquidity = m.income ? "income" : "expense"
            m.date = comment.date
            m.price = parseFloat(m.price.replace(',', '.'))
            m.count = (parseFloat(m.count) || 1)
            m.totalPrice = m.price * m.count
        })
        // console.log("matches", matches)
        items = items.concat(matches)
    }
    return {items: items, startRange: startRange, endRange: endRange};
}

async function convertReportToXls(report) {
    //Todo: figure out what are 3rd and 4th parameters of cell() (might be changed below)
    let wb = new xls.Workbook()
    let wse, wsi;
    const incomes = report.filter(item => item.income);
    const expenses = report.filter(item => !item.income);
    const keys = ['Name', 'Price', 'Count', 'Total Price', 'Date']
    const centered = wb.createStyle({
        alignment: { horizontal: 'center' }
    });
    const totalIncome = incomes.reduce((acc, item) => acc + (item.totalPrice || 0), 0);
    const totalExpense = expenses.reduce((acc, item) => acc - (item.totalPrice || 0), 0);
    if (expenses.length > 0) {
        wse = wb.addWorksheet('Report Expenses')
        for (let i = 0; i < keys.length; i++) {
            let c = wse.cell(1, i + 1).string(keys[i])
            if (i != 0) c.style(centered)
        }
        for (let i = 0; i < expenses.length; i++) {
            wse.cell(i + 2, 1).string(expenses[i].name).style({alignment: {shrinkToFit: true}})
            wse.cell(i + 2, 2).number(expenses[i].price).style(centered)
            wse.cell(i + 2, 3).number(expenses[i].count).style(centered)
            wse.cell(i + 2, 4).number(expenses[i].totalPrice).style(centered)
            wse.cell(i + 2, 5).date(expenses[i].date).style(centered)
        };
        wse.column(1).setWidth(30);
        wse.cell(expenses.length + 2, 1).string('Expenses: ')
        wse.cell(expenses.length + 2, 2, expenses.length + 2, 5, true).number(totalExpense).style(centered)
        wse.cell(expenses.length + 3, 1).string('Incomes: ')
        wse.cell(expenses.length + 3, 2, expenses.length + 3, 5, true).number(totalIncome).style(centered)
        wse.cell(expenses.length + 4, 1).string('Total: ')
        wse.cell(expenses.length + 4, 2, expenses.length + 4, 5, true).number(totalExpense+totalIncome).style(centered)
    }
    if (incomes.length > 0) {
        wsi = wb.addWorksheet('Report Incomes')
        for (let i = 0; i < keys.length; i++) {
            let c = wsi.cell(1, i + 1).string(keys[i])
            if (i != 0) c.style(centered)
        }
    
        for (let i = 0; i < incomes.length; i++) {
            wsi.cell(i + 2, 1).string(incomes[i].name).style({alignment: {shrinkToFit: true}})
            wsi.cell(i + 2, 2).number(incomes[i].price).style(centered)
            wsi.cell(i + 2, 3).number(incomes[i].count).style(centered)
            wsi.cell(i + 2, 4).number(incomes[i].totalPrice).style(centered)
            wsi.cell(i + 2, 5).date(incomes[i].date).style(centered)
        }
        wsi.column(1).setWidth(30);
        
        wsi.cell(incomes.length + 2, 1).string('Incomes: ')
        wsi.cell(incomes.length + 2, 2, incomes.length + 2, 5, true).number(totalIncome).style(centered)
        wsi.cell(incomes.length + 3, 1).string('Expenses: ')
        wsi.cell(incomes.length + 3, 2, incomes.length + 3, 5, true).number(totalExpense).style(centered)
        wsi.cell(incomes.length + 4, 1).string('Total: ')
        wsi.cell(incomes.length + 4, 2, incomes.length + 4, 5, true).number(totalExpense+totalIncome).style(centered)
    }
    
    return {
        file: await wb.writeToBuffer().catch(console.error), 
        totalIncome,
        totalExpense,
        total: totalExpense + totalIncome
    }
}
createDb();
app.listen(process.env.PORT || 8589, () => console.log(`Server is listening on port ${process.env.PORT || 8589}`))