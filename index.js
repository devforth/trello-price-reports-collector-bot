require('dotenv').config()

const moment = require('moment')

const { createMessageAdapter } = require('@slack/interactive-messages')
const slackInteractions = createMessageAdapter(process.env.SLACK_SIGNING_SECRET)

const { WebClient } = require('@slack/web-api');
const slackApp = new WebClient(process.env.SLACK_OAUTH_TOKEN)
const slackBot = new WebClient(process.env.SLACK_BOT_OAUTH_TOKEN)

const Trello = require("trello");
const trello = new Trello(process.env.TRELLO_API_KEY, process.env.TRELLO_OAUTH_TOKEN)

const xls = require('excel4node')

const express = require('express')
const app = express()

app.use('/trellocollector', slackInteractions.expressMiddleware())

slackInteractions.action('month_report', async (payload, respond) => {
    sendMonthReport(payload, respond)
})

slackInteractions.action('prev_month_report', async (payload, respond) => {
    sendMonthReport(payload, respond)
})

async function sendMonthReport(payload, respond) {
    respond({text: 'Collecting data...'})
    let actual_callback_id = payload.callback_id
    if(payload.type == 'interactive_message')
        actual_callback_id = payload.actions[0].value
    let report = await getMonthReport(actual_callback_id).catch(console.error)
    let xlsReport = await convertReportToXls(report.items).catch(console.error)
    await slackBot.files.upload({
        channels: payload.channel.id,
        file: xlsReport.file,
        filetype: 'xlsx',
        filename: `Report${report.startRange.format("DD.MM.YYYY")}-${report.endRange.format("DD.MM.YYYY")}.xlsx`,
        title: `Report${report.startRange.format("DD.MM.YYYY")}-${report.endRange.format("DD.MM.YYYY")}.xlsx`
    }).catch(console.error)

    await slackApp.chat.postMessage({
        channel: payload.channel.id,
        text: `Total price for ${report.startRange.format("DD.MM.YYYY")}-${report.endRange.format("DD.MM.YYYY")}: *${xlsReport.totalPrice}*`
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
        let regex = /(?<name>.+?)\s*[-=]\s*(?<price>\d+[.:]?\d*)(\s*x\s*)?(?<count>\d+)?/
        let lines = comment.data.text.split('\n')
        let matches = lines.map(l => regex.exec(l))
        matches = matches.filter(m => m != null|| m != undefined).map(m => m.groups)
        matches.forEach(m => {
            m.date = comment.date
            m.price = parseFloat(m.price.replace(',', '.'))
            m.count = (parseFloat(m.count) || 1)
            m.totalPrice = m.price * m.count
        })
        items = items.concat(matches)
    }
    return {items: items, startRange: startRange, endRange: endRange};
}

async function convertReportToXls(report) {
    let wb = new xls.Workbook()
    let ws = wb.addWorksheet('Report')
    let keys = ['Name', 'Price', 'Count', 'Total Price', 'Date']
    let centered = wb.createStyle({
        alignment: { horizontal: 'center' }
    })
    for(let i = 0; i < keys.length; i++) {
        let c = ws.cell(1, i+1).string(keys[i])
        if (i != 0) c.style(centered)
    }

    for(let i = 0; i < report.length; i++) {
        ws.cell(i+2, 1).string(report[i].name).style({alignment: {shrinkToFit: true}})
        ws.cell(i+2, 2).number(report[i].price).style(centered)
        ws.cell(i+2, 3).number(report[i].count).style(centered)
        ws.cell(i+2, 4).number(report[i].totalPrice).style(centered)
        ws.cell(i+2, 5).date(report[i].date).style(centered)
    }

    let totalPrice = report.reduce((a, b) => a + (b.totalPrice || 0), 0);

    ws.column(1).setWidth(30);
    ws.cell(report.length+2, 1).string('Total price: ')
    ws.cell(report.length+2, 2, report.length+2, 5, true).number(totalPrice).style(centered)

    return {file: await wb.writeToBuffer().catch(console.error), totalPrice: totalPrice}
}

app.listen(process.env.PORT || 8589, () => console.log(`Server is listening on port ${process.env.PORT || 8589}`))