# trello-price-reports-collector-bot

Bot which shows report collected from trello specified Board comments for current or previous month:

```
Arabica Coffee -11.00
Arabica Coffee - 11.00
Arabica Coffee-11.00
Arabica Coffee-12.00x1
Arabica Coffee - 11.00 x 2
Arabica Coffee - 11.00 x2
Arabica Coffee -11.00 x 10
Arabica Coffee -11.00x 2
```

In each comment it seraches for expenses on some products. Then it generates report and summary.


# How to deploy bot

Basically you need to start `node index.js` and pass required env variables or create `.env` file with these variables in execution folder. Check `.env.sample` to list of required environment variables.

If you want to host locally for testing purposes use: `ngrok http {PORT}`

Then you need to create Slack app at https://api.slack.com/apps/, go to `Interactive Components` and point `Request URL` to `http(s)://deployed_domain:8589(or your port)/trellocollector`

To get `TRELLO_BOARD_ID`

Get board link
https://trello.com/b/12daFy0n/office

replace `/office` with `/reports.json` and visit link, e.g. :

https://trello.com/b/12daFy0n/reports.json

first `id` param will be board id
