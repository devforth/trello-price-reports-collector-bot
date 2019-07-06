# trello-price-reports-collector-bot

Bot which shows report collected from trello comments for current or previous month:

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

Command connects to Trello and searches for comments in specified Board

```
TRELLO_API_KEY
TRELLO_OAUTH_TOKEN
TRELLO_BOARD_NAME
```
