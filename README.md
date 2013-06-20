# Node-DataTables 

## DataTables server-side script for Node.js

Requires:

* `MySql` - https://github.com/felixge/node-mysql
```bash
npm install mysql@2.0.0-alpha8
```

* `Express.js` - https://npmjs.org/package/express
```bash
npm install express
```

## Setup:

Set the MySQL information (make sure to set sTable to the table you are querying)
```js
var sTable = '';
var connection = mysql.createConnection({
  host     : '',
  user     : '',
  password : '', 
  database : '',
});
```
Run the script with Node.js, and initialize your DataTable with the ajax source as the location to the server.

```js
oTable = $('#example').dataTable({
    "bServerSide": true,
    "sAjaxSource": "http://URL:8888/server",
  });
```

## Info:

aColumns is set at launch with the function `getColumnNames`. 

