Node-DataTables - DataTables server-side script for Node.js

Requires:

* (MySql) - https://github.com/felixge/node-mysql : npm install mysql@2.0.0-alpha5
* (ExpressJS) - https://npmjs.org/package/express : npm install express

Setup:
Run this script with nodejs, and initialize your table with the ajax source as the location to the server. It should act similar to that of the php example:

    oTable = $('#example').dataTable({
        "bServerSide": true,
        "sAjaxSource": "http://URL.com:8888/server",
      });

