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

Then you need to create Slack app at https://api.slack.com/apps/, go to `Interactive Components` and point `Request URL` to `http(s)://deployed_domain(:or your port)/trellocollector`

You also need to add 2 actions:

![](https://maketips.net/media/uploads/2019/07/07/pvzKRu5V7tSu7DJncm22kE-3e72e872.png)

To get `TRELLO_BOARD_ID`

Get board link
https://trello.com/b/12daFy0n/office

replace `/office` with `/reports.json` and visit link, e.g. :

https://trello.com/b/12daFy0n/reports.json

first `id` param will be board id

## Deploy bot to Docker

We have also Dockerfile. If you are using docker-compose you can write config like this

```
  slackcollectorbot:
    build: ../trello-price-reports-collector-bot
    environment:
      - SLACK_SIGNING_SECRET=xxxxxxxxxxxxxxxxxxxxxx
      
      # !!!!!!!! TODO replace with client id and secret
      - SLACK_OAUTH_TOKEN=xoxp-xxxxxxxxx-xxxxxxxxx-xxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxx 
      - SLACK_BOT_OAUTH_TOKEN=xoxb-xxxxxxxxx-xxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxx
      - TRELLO_BOARD_ID=xxxxxxxxxxxxxxxxxxxxxx
      - TRELLO_API_KEY=xxxxxxxxxxxxxxxxxxxxxx
      - TRELLO_OAUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
      - PORT=8589
      - REPORT_MONTH_OFFSET_IN_DAYS=16
      - DEBUG=express:*  # if you want to see bot proxied requests in logs
    restart: always
    ports:
      - "8589:8589"  # for security specify ports only if you have no proxy behind, this will expose ports outside
    volumes:
      - slackbotdb:/db/
      
  volumes:
    slackbotdb:
```

Then if you have some proxy on docker host (e.g. Nginx), you can redirect requests like this:

```
server {
  listen 80;
  # ssl configs here if needed
  server_name bots.devforth.io;

  location /trellocollector {
      proxy_http_version 1.1;
      proxy_set_header Connection "";
      proxy_pass http://slackcollectorbot:8589/trellocollector;
  }
}
```
