var mysql = require('mysql');
const dotenv = require('dotenv');
dotenv.config();

var connectionPool = mysql.createPool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	port: 3306,
	debug: false,
	charset : 'utf8mb4'
});

connectionPool.getConnection(function(err, connection) {
	if(err)
		throw err;
	/*else
		console.log(connection);*/
});

module.exports = connectionPool;