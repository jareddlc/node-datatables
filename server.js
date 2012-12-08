/* Node-DataTables
 * https://github.com/jareddlc/Node-DataTables
 * Fill in the MySQL information below
 */

//------------------------- Setup
//---MySQL
var mysql = require('mysql');
var DATABASE = '';
var sTable = '';
var sIndexColumn = '*';
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : '',
  password : '', 
  database : '',
});

function handleDisconnect(connection){
  connection.on('error', function(err){
    if(!err.fatal)
    {
      return;
    }
    if(err.code !== 'PROTOCOL_CONNECTION_LOST')
    {
      throw err;
    }
    console.log('Re-connecting lost connection: ' +err.stack);
    connection = mysql.createConnection({
      host     : '',
      user     : '',
      password : '', 
      database : '',
    });
    handleDisconnect(connection);
    connection.connect();
  });
}

handleDisconnect(connection);

startup();
console.log('Server initilizing...');

//---ExpressJS
var express = require('express');
var app = express();

//---Middleware: Allows cross-domain requests (CORS)
var allowCrossDomain = function(req, res, next){
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
}

//---App config
app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'secret'}));
  app.use(express.methodOverride());
  app.use(allowCrossDomain);
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

var cache_tables = {};
var cache_data = {};
var cache_colNames = {};
var cache_colCount = {};
var cache_rowCount = {};
var request = {};
var aColumns = [];

//------------------------- Endpoints
app.get('/', function(req, res, next){
  console.log('GET request to /');
});

app.get('/server', function(req, res, next){
  console.log('GET request to /server');
  request = req.query;
  server(res);
})

app.get('/getColumnNames', function(req, res, next){
  console.log('GET request to /getColumnNames');
  sendJSON(res, 200, cache_colNames);
});

app.get('/getColumnCount', function(req, res, next){
  console.log('GET request to /getColumnCount');
  console.log('column count = ' +cache_colCount);
  sendJSON(res, 200, cache_colCount);
});

app.get('/getRowCount', function(req, res, next){
  console.log('GET request to /getRowCount');
  console.log('row count = ' +cache_rowCount);
  sendJSON(res, 200, cache_rowCount);
});

app.get('/getTables', function(req, res, next){
  console.log('GET request to /getTables');
  getTables(req, res);
  sendJSON(res, 200, cache_tables);
});

app.post('/postRow', function(req, res, next){
  console.log('POST request to /postRow');
  postRow(req, res);
  console.log(req.body);
});

app.post('/postTable', function(req, res, next){
  console.log('POST request to /selTable');
  postTable(req, res);
  console.log(req.body);
});

app.post('/postCol', function(req, res, next){
  console.log('POST request to /postCol');
  postColumn(req, res);
  console.log(req.body);
});

app.post('/putRow', function(req, res, next){
  console.log('POST request to /putRow');
  putRow(req, res);
  console.log(req.body);
});

app.post('/selTable', function(req, res, next){
  console.log('POST request to /selTable');
  selTable(req, res);
  console.log(req.body);
});

app.listen(8888);
console.log('Express server started on port 8888');

//------------------------- Functions
function startup()
{
    getColumnCount();
    getRowCount();
    getColumnNames();
    getTables();
}

function server(res)
{
  //Paging
  var sLimit = "";
  if(request['iDisplayStart'] && request['iDisplayLength'] != -1)
  {
    sLimit = 'LIMIT ' +request['iDisplayStart']+ ', ' +request['iDisplayLength']
  }
  
  //Ordering
  var sOrder = "";
  if(request['iSortCol_0'])
  {
    sOrder = 'ORDER BY ';

    for(var i = 0 ; i < request['iSortingCols']; i++)
    {
      if(request['bSortable_'+parseInt(request['iSortCol_'+i])] == "true")
      {
        sOrder += aColumns[parseInt(request['iSortCol_'+i])] +" "+ request['sSortDir_'+i] +", ";
      }
    }
    
    sOrder = sOrder.substring(0, sOrder.length -2)
    if(sOrder == 'ORDER BY')
    {
      console.log("sOrder == ORDER BY");
      sOrder = "";
    }
  }

  //Filtering
  var sWhere = "";
  if(request['sSearch'] && request['sSearch'] != "")
  {
    sWhere = "WHERE (";
    for(var i=0 ; i<aColumns.length; i++)
    {
      sWhere += aColumns[i]+ " LIKE " +"\'%"+request['sSearch']+"%\'"+" OR ";
    }

    sWhere = sWhere.substring(0, sWhere.length -4);
    sWhere += ')';
  }
  
  //Individual column filtering
  for(var i=0 ; i<aColumns.length; i++)
  {
    if(request['bSearchable_'+i] && request['bSearchable_'+i] == "true" && request['sSearch_'+i] != '')
    {
      if(sWhere == "")
      {
        sWhere = "WHERE ";
      }
      else
      {
        sWhere += " AND ";
      }
      sWhere += " "+aColumns[i]+ " LIKE " +request['sSearch_'+i]+ " ";
    }
  }
  
  //Queries
  var sQuery = "SELECT SQL_CALC_FOUND_ROWS " +aColumns.join(',')+ " FROM " +sTable+" "+sWhere+" "+sOrder+" "+sLimit +"";

  var rResult = {};
  var rResultFilterTotal = {};
  var aResultFilterTotal = {};
  var iFilteredTotal = {};
  var iTotal = {};
  var rResultTotal = {};
  var aResultTotal = {};

  connection.query(sQuery, function selectCb(err, results, fields){
    if(err){
      console.log(err);
    }
    
    rResult = results;
	
    //Data set length after filtering 
    sQuery = "SELECT FOUND_ROWS()";

    connection.query(sQuery, function selectCb(err, results, fields){
      if(err){
        console.log(err);
      }
      rResultFilterTotal = results;
      aResultFilterTotal = rResultFilterTotal;
      iFilteredTotal = aResultFilterTotal[0]['FOUND_ROWS()'];

      //Total data set length 
      sQuery = "SELECT COUNT("+sIndexColumn+") FROM " +sTable;

      connection.query(sQuery, function selectCb(err, results, fields){
        if(err){
          console.log(err);
        }
        rResultTotal = results;
        aResultTotal = rResultTotal;
        iTotal = aResultTotal[0]['COUNT(*)'];

        //Output
        var output = {};
        var temp = [];

        output.sEcho = parseInt(request['sEcho']);
        output.iTotalRecords = iTotal;
        output.iTotalDisplayRecords = iFilteredTotal;
        output.aaData = [];
        
        var aRow = rResult;
        var row = [];

        for(var i in aRow)
        {
          for(Field in aRow[i])
          {
            if(!aRow[i].hasOwnProperty(Field)) continue; 
            temp.push(aRow[i][Field]);
          }
          output.aaData.push(temp);
          temp = [];
        }
        sendJSON(res, 200, output);
      });
    });
  }); 
}

function getColumnCount()
{
  connection.query('SELECT * FROM '+sTable +' LIMIT 1',
  function selectCb(err, results, fields){
    if(err){
      console.log(err);
    }

    var count=0;
    for(var i in fields)
    {
      count++;
    }
    cache_colCount = count;
  });
}

function getRowCount()
{
  connection.query('SELECT COUNT(*) FROM '+sTable,
    function selectCb(err, results, fields){
      if(err){
        console.log(err);
      }
      var count = parseInt(results[0]['COUNT(*)']);
      cache_rowCount = count;
    });
}

function getColumnNames()
{
  aColumns = [];
  connection.query('SHOW COLUMNS FROM '+sTable,
    function selectCb(err, results, fields){
      if(err){
        console.log(err);
      }
      for(var i in results)
      {
        aColumns.push(results[i]['Field']);
      }
      cache_colNames = results;
    });
}

function getTables(req, res)
{
  connection.query('SHOW TABLES',
    function selectCb(err, results, fields){
      if(err){
        console.log(err);
      }
      var temp = [];
      for(var i in results)
      {  
        temp[i] = results[i]['Tables_in_'+DATABASE];
      }
      cache_tables = temp;
    });
}

function sendJSON(res, httpCode, body)
{
  var response = JSON.stringify(body);
  res.send(httpCode,response);
}

function postTable(req, res)
{
  var Table = req.body['form-db-create-name'];
  Table = cleanString(Table);
  connection.query('CREATE TABLE '+Table+'(id int(10) UNSIGNED AUTO_INCREMENT PRIMARY KEY) ENGINE=InnoDB CHARACTER SET utf8 COLLATE utf8_bin',
    function selectCb(err, results, fields){
      if(err){
        console.log(err);
      }
      getTables();
    });
}

function postRow(req, res)
{
  var counter = 0;
  var key_name = [];
  var key_value = [];
  var into = "";
  var values = "";
  var p_open = "(";
  var p_close = ")";
  var quote = "\"";
  var comma = ",";

  into += p_open;
  values += p_open;

  for (var key in req.body){
    into += key;
    into += comma;

    values += quote;
    values += req.body[key];
    values += quote;
    values += comma;

    key_name[counter] = key;
    key_value[counter] = req.body[key];
    counter += 1;
  }

  into = into.substr(0, into.length-1);
  values = values.substr(0, values.length-1);

  into += p_close;
  values += p_close;

  connection.query('INSERT INTO ' +sTable+ ' ' +into+ ' VALUES ' +values,
  function selectCb(err, results, fields){
      if(err){
        console.log(err);
      }
      sendJSON(res, 200, "success");

      getColumnCount();
      getRowCount();
      getColumnNames();
      getTables();
    });
}

function postColumn(req, res)
{
  var into = "";
  var quote = "\'";

  for(var key in req.body){

    if(key == "form-col-add-name")
    {
      into += cleanString(req.body[key]);
      into += " ";
    }

    if(req.body[key] == "int")
    {
      into += "INT(10)";
    }

    if(req.body[key] == "varchar")
    {
      into += "VARCHAR(255)";
    }

    if(req.body[key] == "enum")
    {
      into += "ENUM";
    }

    if(key == "form-col-add-param")
    {
      into += "(";
      for(var i in req.body[key])
      {
        into += quote;
        into += req.body[key][i];
        into += quote;
        into += ","
      }
      into = into.substr(0, into.length-1);
      into += ")";
    }
  }
  console.log(into);
  connection.query('ALTER TABLE '+sTable+' ADD ' +into,
    function selectCb(err, results, fields){
      if(err){
        console.log(err);
      }
      sendJSON(res, 200, "success");

      getColumnCount();
      getRowCount();
      getColumnNames();
      getTables();
  });
}

function putRow(req, res)
{
  var into = "";
  var p_open = "(";
  var p_close = ")";
  var quote = "\"";
  var comma = ",";
  var id;

  for (var key in req.body){
    if(key ==  "id")
    {
      id = req.body[key];
    }
    else{
      //into += quote;
      into += key;
      //into += quote;
      into += "=";
      into += quote;
      into += req.body[key];
      into += quote;
      into += comma;
    }
  }

  into = into.substr(0, into.length-1);

  connection.query('UPDATE ' +sTable+ ' SET ' +into+ ' WHERE id=' +id,
  function selectCb(err, results, fields){
      if(err){
        console.log(err);
      }
      sendJSON(res, 200, "success");

      getColumnCount();
      getRowCount();
      getColumnNames();
      getTables();
    });
}

function selTable(req, res)
{
  sTable = req.body['db-sel'];
  getColumnNames();
  getColumnCount();
  getRowCount();
  getTables();
  sendJSON(res, 200, "success");
}

function cleanString(str)
{
  var output = "";
  output += str.replace(/\s+/g, '_');
  output = output.replace(/\'+/g, '');
  output = output.replace(/\"+/g, '');
  output = output.replace(/\\+/g, '');
  return output;
}
