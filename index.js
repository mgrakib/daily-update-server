/** @format */

const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nvffntx.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

async function run() {
	try {
		// Connect the client to the server	(optional starting in v4.7)
		await client.connect();
		const workStationCollection = client
			.db("pidsDailyUpdate")
			.collection("workStation");
		const userCollection = client.db("pidsDailyUpdate").collection("users");

		// funcation
		// add new user to db funcation
		const addUserToDB = async (req, res, next) => {
			const body = req.body;
			const email = body?.emali;
			const name = body?.name;
			const servicId = body?.servicId;
			const workStationName = body?.workStationName;
			const stationKey = body?.stationKey;

			const query = { email };

			const findUser = await userCollection.findOne(query);

			if (!findUser) {
				const userInfo = {
					name,
					email,
					servicId,
					workStationName,
					stationKey,
				};
				// add to new user
				const insertUser = await userCollection.insertOne(userInfo);
			}

			next();
		};

		// add new work station
		const addNewStation = async (req, res, next) => {
			const body = req.body;
			const name = body?.name;
			const email = body?.emali;
			const servicId = body?.servicId;
			const workStationName = body?.workStationName;
			const stationKey = body?.stationKey;

			

			// add to workstaion
			const workStationQuery = { stationKey };
			const workStaionResult = await workStationCollection.findOne(
				workStationQuery
			);

			if (!workStaionResult) {
				// new workstation info
				const newWorkStation = {
					workStationName,
					stationKey,
					active: [],
					lockup: [],
					jailWarder: {
						entry: [],
						release: [],
					},
					operator: [
						{
							id: servicId,
							name,
							email,
							entry: [],
							release: [],
						},
					],
				};
				const insertNewWorkStation =
					await workStationCollection.insertOne(newWorkStation);
			} else {
				const addNewOperator = {
					id: servicId,
					name,
					email,
					entry: [],
					release: [],
				};
				workStaionResult.operator.push(addNewOperator);
				const updateWorkStationOperator =
					await workStationCollection.updateOne(
						{
							stationKey,
						},
						{ $set: { operator: workStaionResult.operator } }
					);
			}

			next();
		};

		const transferWorkStation = async (req, res, next) => {
			const body = req.body;
			const email = body.email;
			const servicId = body.operatorId;
			const workStationName = body.newStaionName;
			const stationKey = body.newStaionKey;
			const currentStationKey = body.currentStationKey;
			const userData = await workStationCollection
				.aggregate([
					{ $match: { "operator.email": email } },
					{
						$project: {
							operator: {
								$filter: {
									input: "$operator",
									as: "op",
									cond: { $eq: ["$$op.email", email] },
								},
							},
						},
					},
				])
				.toArray();

			const isExistWorkStation = await workStationCollection.findOne({
				stationKey,
			});
			if (!isExistWorkStation) {
				const newWorkStation = {
					workStationName,
					stationKey,
					active: [],
					lockup: [],
					jailWarder: {
						entry: [],
						release: [],
					},
					operator: [userData[0]?.operator[0]],
				};

				const insertNewWorkStation =
					await workStationCollection.insertOne(newWorkStation);
			} else {

				isExistWorkStation.operator.push(userData[0]?.operator[0]);
			
				const updateWorkStationOperator =
					await workStationCollection.updateOne(
						{
							stationKey,
						},
						{ $set: { operator: isExistWorkStation.operator } }
					);

				const fing = await workStationCollection.findOne({
					stationKey,
				});
				
				
			}

			// remove operator form old station
				const removeUser = await workStationCollection.updateOne(
					{ "operator.email": email, stationKey: currentStationKey },
					{
						$pull: {
							operator: { email },
						},
					}
				);
			next();
		};

		// API ###############

		app.get(`/single-user`, async (req, res) => {
			const email = req.query.email;
			const query = { email };

			const singleUser = await userCollection.findOne(query);
			res.send(singleUser);
		});

		// all user for update field
		app.get("/workstation", async (req, res) => {
			const email = req.query.email;
			const userFindQuery = { email };
			const userResutl = await userCollection.findOne(userFindQuery);

			const stationKey = userResutl?.stationKey;
			const wordStationQuery = { stationKey };
			const workStationResult = await workStationCollection.findOne(
				wordStationQuery
			);

			res.send(workStationResult);
		});

		// add user and add to workstaion use funcatjion *****************
		app.post("/add-user", addUserToDB, addNewStation, async (req, res) => {
			res.send({});
		});

		// update entry and value
		app.patch("/updateDailyValue", async (req, res) => {
			const body = req.body;

			const {
				newData,
				active,
				jailWarderEntry,
				jailWarderRelease,
				lockup,
				stationName,
			} = body;

			const bulkOps = newData.map(({ email, entry, release }) => ({
				updateOne: {
					filter: {
						stationKey: stationName,
						"operator.email": email,
					},
					update: {
						$push: {
							"operator.$.entry": {
								$each: [entry],
								$position: 0,
							},
							"operator.$.release": {
								$each: [release],
								$position: 0,
							},
						},
					},
				},
			}));

			const reslut = await workStationCollection.bulkWrite(bulkOps);

			const updaeValue = await workStationCollection.updateOne(
				{
					stationKey: stationName,
				},
				{
					$push: {
						[`jailWarder.entry`]: {
							$each: [parseInt(jailWarderEntry)],
							$position: 0,
						},
						[`jailWarder.release`]: {
							$each: [parseInt(jailWarderRelease)],
							$position: 0,
						},
						[`lockup`]: {
							$each: [parseInt(lockup)],
							$position: 0,
						},
						[`active`]: {
							$each: [parseInt(active)],
							$position: 0,
						},
					},
				}
			);
			// data.forEach(({ serviceId, entry, release }) => {
			// 	db.collection.updateOne(
			// 		{
			// 			stationKey: "C789",
			// 			"operator.serviceId": serviceId,
			// 		},
			// 		{
			// 			$push: {
			// 				"operator.$.entry": {
			// 					$each: [entry],
			// 					$position: 0,
			// 				},
			// 				"operator.$.release": {
			// 					$each: [release],
			// 					$position: 0,
			// 				},
			// 			},
			// 		}
			// 	);
			// });

			res.send({});
		});

		// get user info
		app.get("/user-summary", async (req, res) => {
			const email = req.query.email;
			// const query = { "operator.email" : email };

			const userData = await workStationCollection
				.aggregate([
					{ $match: { "operator.email": email } },
					{
						$project: {
							operator: {
								$filter: {
									input: "$operator",
									as: "op",
									cond: { $eq: ["$$op.email", email] },
								},
							},
						},
					},
				])
				.toArray();

			res.send(userData);
		});

		// transfer operator user use funcation ********
		app.put("/transfer-operator", transferWorkStation, async (req, res) => {
			const body = req.body;
			const email = body.email;
			const servicId = body.operatorId;
			const workStationName = body.newStaionName;
			const stationKey = body.newStaionKey;

			const query = { servicId };
			const isStationExist = await userCollection.updateOne(query, {
				$set: {
					workStationName,
					stationKey,
				},
			});
console.log(body , isStationExist);
			res.send({});
		});

		// Send a ping to confirm a successful connection
		await client.db("admin").command({ ping: 1 });
		console.log(
			"Pinged your deployment. You successfully connected to MongoDB!"
		);
	} finally {
		// Ensures that the client will close when you finish/error
		// await client.close();
	}
}
run().catch(console.dir);

// free
app.get("/", (req, res) => {
	res.send("daily update server is running...");
});

app.listen(port, () => {
	console.log(`this server is running on port : ${port}`);
});
