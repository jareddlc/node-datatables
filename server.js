/* Node-DataTables
 * https://github.com/jareddlc/Node-DataTables
 * this is a copy of the server side script located at: http://datatables.net/release-datatables/examples/data_sources/server_side.html
 * Fill in the MySQL information below
 */

//------------------------- Setup
//---MySQL
var mysql = require('mysql');
var sIndexColumn = '*';
var sTable = '';
var connection = mysql.createConnection({
  host     : '',
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
    connection.end();
    console.log('\nRe-connecting lost connection: ' +err.stack);
    console.log(connection.config);

    setTimeout(function()
    {
      connection = mysql.createConnection(connection.config);
      handleDisconnect(connection);
      connection.connect();
    }, 1000); // 1 sec
  });
}

handleDisconnect(connection);

//---Grabs columns names and populates aColumns
getColumnNames();
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
});

//---Global vars
var request = {};
var aColumns = [];

//------------------------- Endpoints
app.get('/server', function(req, res, next){
  console.log('GET request to /server');
  request = req.query;
  server(res);
})

app.listen(8888);
console.log('Express server started on port 8888');

//------------------------- Functions
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
    });
}

function sendJSON(res, httpCode, body)
{
  var response = JSON.stringify(body);
  res.send(httpCode,response);
}

