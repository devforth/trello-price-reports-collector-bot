# trello-price-reports-collector-bot

Supports two commands:

```
month report
prev month report
```

Command connects to Trello and searches for comments in specified Board

```
TRELLO_API_KEY
TRELLO_OAUTH_TOKEN
TRELLO_BOARD_NAME
```

In each comment it seraches for expenses on some products:

```
Arabica Coffe -11.00
Arabica Coffe - 11.00
Arabica Coffe-11.00
Arabica Coffe-12.00x1
Arabica Coffe - 11.00 x 2
Arabica Coffe - 11.00 x2
Arabica Coffe -11.00 x 10
Arabica Coffe -11.00x 2
```

Then it generates report and summary
