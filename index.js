require('dotenv').config();

const { createMessageAdapter } = require('@slack/interactive-messages');
const slackInteractions = createMessageAdapter(process.env.SLACK_SIGNING_SECRET);

const { WebClient } = require('@slack/web-api');
const slack = new WebClient(process.env.SLACK_OAUTH_TOKEN)

const Trello = require("trello");
const trello = new Trello(process.env.TRELLO_API_KEY, process.env.TRELLO_OAUTH_TOKEN);

const express = require('express')
const app = express()

app.use('/trellocollector', slackInteractions.expressMiddleware());

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

slackInteractions.action('month_report', async (payload, respond) => {
    respond({text: 'Collecting data...'})
    console.log(process.env.TRELLO_BOARD_ID)
    let cards = await trello.getCardsOnBoardWithExtraParams(process.env.TRELLO_BOARD_ID)
    console.log(cards);
    slack.chat.postMessage({
        text: 'Here your data!',
        channel: payload.channel.id
    })
})

slackInteractions.action('prev_month_report', async (payload, respond) => {
    respond({text: 'Collecting data...'})
    slack.chat.postMessage({
        text: 'Here your data!',
        channel: payload.channel.id
    })
})

async function a() {
    let cards = await trello.getCardsOnBoard(process.env.TRELLO_BOARD_ID)
    let cards_action_promises = cards.map(card => trello.makeRequest('get', '/1/cards/' + card.id + '/actions', { webhooks: true }));
    let cards_action = await Promise.all(cards_action_promises);
    let card_comments = []

    for(let i = 0; i < cards.length; i++) {
        let c = {id: cards[i].id, comment_actions: []}
        for(action of cards_action[i]) {
            console.log(action);
            if(action.type == "commentCard")
                c.comment_actions.push(action)
        }
        // card_comments.push(c)
    }

    // console.log(card_comments);
}

a();

app.listen(process.env.PORT)
console.log(`Server is listening on port ${process.env.PORT}`)