var path = require('path');
var cors = require('cors');
var validUrl = require('valid-url');
const moment = require('moment-timezone');
//const tzone = "Asia/Kolkata";
const tzone = "America/Los_Angeles";
const dotenv = require('dotenv');
dotenv.config();
base_url = process.env.base_url;
image_url = 'http://boker.cwsbuild.com';

var app = require('express')();

var http = require('http').Server(app);

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    next();
});

app.use(cors());

var bodyParser = require('body-parser'); 
app.use(bodyParser.json({limit:'50mb'})); 
app.use(bodyParser.urlencoded({extended:true, limit:'50mb',parameterLimit:50000}));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

const con = require("./config/db_connection.js");

var io = require('socket.io')(http);

var connected_users = [];
app.post("/get_connected_users", function (req, res) {
	
	  console.log(connected_users);
	  res.send(connected_users);
	
})

app.post("/get_chat_user_list_byProductId", function (req, res) {
	//console.log(req);
	console.log("seversite");
	params = req.body;

    if(params.user_id === undefined || params.user_id == '') {
      let res_json = {result: 'failure', message: 'user_id is missing'};
      res.send(res_json);
      return;
    }

	var numPerPage = parseInt(params.page_limit, 10) || 10;
    var page = parseInt(params.page_record, 10) || 1;

	var numPages;
  	var skip = (page-1) * numPerPage;
  	var limit = "  LIMIT  "+skip + ',' + numPerPage;

  	let cond ="";
  	if(params.product_id>0){
  		cond = " AND product_id = '" + params.product_id + "'";
  	}

	let sqlQuery = "SELECT bkch.*,(SELECT message FROM bk_chat_history WHERE id = (SELECT MAX(id) AS id FROM bk_chat_history WHERE ((sender_id = bkch.sender_id AND receiver_id = bkch.receiver_id) OR (sender_id = bkch.receiver_id AND receiver_id = bkch.sender_id)) AND product_id = bkch.product_id)) AS last_message,(SELECT created_date FROM bk_chat_history WHERE id = (SELECT MAX(id) AS id FROM bk_chat_history WHERE ((sender_id = bkch.sender_id AND receiver_id = bkch.receiver_id) OR (sender_id = bkch.receiver_id AND receiver_id = bkch.sender_id)) AND product_id = bkch.product_id)) AS last_created_date,sender.id AS sender_user_id,sender.profile_pic,sender.username AS sender_username FROM bk_chat_history as bkch LEFT JOIN `bk_users` `sender` ON `sender`.`id` = `bkch`.`sender_id` WHERE ((sender_id = '" + params.user_id + "' OR receiver_id = '" + params.user_id + "') "+cond+") Group BY bkch.sender_id ORDER BY bkch.id DESC "+limit;

  //console.log(sqlQuery);

	con.query("SELECT count(*) as numRows FROM ("+sqlQuery+")t ",async function (err, rows)  {
	    if (err) {
	      //console.log("error: ", err);
	      res.send(err);
	      return;
	    }
	    if (await rows.length && rows[0].numRows>0) {
	        var numRows = rows[0].numRows;
	        var numPages = Math.ceil(numRows / numPerPage);
	        await con.query(sqlQuery,await function (err, chatHistoryList)  {
	            if(err) {
	                console.log("error: ", err);
	                res.send(err);
	            }else{
	                  if ((page-1) < numPages) {
	                    pagination = {
	                      total:numRows,
	                      current: page,
	                      perPage: numPerPage,
	                      previous: page > 1 ? page - 1 : undefined,
	                      next: (page-1) < numPages - 1 ? page + 1 : undefined
	                    }
	                  }
	                  else {
	                    pagination = {
	                    err: 'queried page ' + page + ' is >= to maximum page number ' + numPages
	                  }
	                }

	                var promises = [];
					  for (let i=0;i<chatHistoryList.length;i++) {
					    let profile_pic = chatHistoryList[i].profile_pic && !validUrl.isUri(chatHistoryList[i].profile_pic) ? image_url+'/uploads/images/'+chatHistoryList[i].profile_pic : chatHistoryList[i].profile_pic;
					    profile_pic =  profile_pic!=null && profile_pic!='' ? profile_pic : image_url+'/uploads/images/dummy_image.png';

					    chatHistoryList[i].profile_pic = profile_pic;

					    promises.push(chatHistoryList[i]);
					  }
					  Promise.all(promises)
					    .then(() => {
					      //console.log(promises);
					      
			                res.send({result: 'success', data:{chat_history: promises, pagination:pagination}});
			                return;
					    })
					    .catch((e) => {
					        // handle errors here
					        console.log(e);
					    });
	            }
	        });     
	    }
	    else{
	          res.send({result: 'failure', message: 'Not found', kind: "not_found" });
	          return;
	    }

	  });
});

app.post("/get_chat_history", function (req, res) {
	//console.log(req);
	console.log("seversite");
	params = req.body;
     if(params.sender_id === undefined || params.sender_id == '') {
      let res_json = {result: 'failure', message: 'sender_id is missing'};
      res.send(res_json);
      return;
    }
    if(params.receiver_id === undefined || params.receiver_id == '') {
      let res_json = {result: 'failure', message: 'receiver_id is missing'};
      res.send(res_json);
      return;
    }

	var numPerPage = parseInt(params.page_limit, 10) || 10;
    var page = parseInt(params.page_record, 10) || 1;

	var numPages;
  	var skip = (page-1) * numPerPage;
  	var limit = "  LIMIT  "+skip + ',' + numPerPage;

  	let cond ="";
  	if(params.product_id>0){
  		cond = " AND product_id = '" + params.product_id + "'";
  	}

	let sqlQuery = "SELECT bkch.*,receiver.id AS receiver_user_id,receiver.username AS receiver_username,sender.id AS sender_user_id,sender.username AS sender_username FROM bk_chat_history as bkch LEFT JOIN `bk_users` `sender` ON `sender`.`id` = `bkch`.`sender_id` LEFT JOIN `bk_users` `receiver` ON `receiver`.`id` = `bkch`.`receiver_id`  WHERE ((sender_id = '" + params.sender_id + "' AND receiver_id = '" + params.receiver_id + "') OR (sender_id = '" + params.receiver_id + "' AND receiver_id = '" + params.sender_id + "') "+cond+") ORDER BY bkch.id DESC "+limit;

  //console.log(sqlQuery);

	con.query("SELECT count(*) as numRows FROM ("+sqlQuery+")t ",async function (err, rows)  {
	    if (err) {
	      //console.log("error: ", err);
	      res.send(err);
	      return;
	    }
	    if (await rows.length && rows[0].numRows>0) {
	        var numRows = rows[0].numRows;
	        var numPages = Math.ceil(numRows / numPerPage);
	        await con.query(sqlQuery,await function (err, chatHistoryList)  {
	            if(err) {
	                console.log("error: ", err);
	                res.send(err);
	            }else{
	                  if ((page-1) < numPages) {
	                    pagination = {
	                      total:numRows,
	                      current: page,
	                      perPage: numPerPage,
	                      previous: page > 1 ? page - 1 : undefined,
	                      next: (page-1) < numPages - 1 ? page + 1 : undefined
	                    }
	                  }
	                  else {
	                    pagination = {
	                    err: 'queried page ' + page + ' is >= to maximum page number ' + numPages
	                  }
	                }
	                res.send({result: 'success', data:{chat_history: chatHistoryList, pagination:pagination}});
	                return;
	            }
	        });     
	    }
	    else{
	          res.send({result: 'failure', message: 'Not found', kind: "not_found" });
	          return;
	    }

	  });
});

app.get("/", function (req, res) {
	res.render('index.ejs');
});


clients = 0;
var users = [];

io.on("connection", function (socket) {
	clients++;
	console.log("User connected: ",  socket.id);

	socket.on("user_connected", function (userIds) {
		console.log(userIds);
		users["room_"+userIds.receiver_id] = socket.id;
		connected_users.push(userIds.receiver_id);
		console.log(users);
		io.emit("user_connected", userIds);
	});

	socket.on("send_message", function (data) {
		var socketId = users["room_"+data.receiver_id];
		console.log(socketId);
        var created_date = moment().tz(tzone).format('YYYY-MM-DD HH:mm:ss');
        data.created_date = created_date;
		console.log(data);
		socket.to(socketId).emit("message_received", data);

        var productId = (data.product_id) ? data.product_id : 0 ;

		con.query("INSERT INTO bk_chat_history (product_id,sender_id, receiver_id, message , created_date , updated_date) VALUES ('" + productId + "','" + data.sender_id + "', '" + data.receiver_id + "', '" + data.message + "','"+created_date+"','"+created_date+"')",function(err,rows){
            if(err) throw err;
            //
        });
	});

	//Whenever someone disconnects this piece of code executed
   socket.on('disconnect', function () {
   	    clients--;
        io.sockets.emit('newclientconnect',{ description: clients + ' clients connected!'})
        console.log(clients+'user disconnected');
   });
});


http.listen(process.env.PORT, function() {
   console.log('listening on *: '+process.env.PORT);
});