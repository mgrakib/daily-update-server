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

		// get all entry operator
		const getTotalEntryOperator = async date => {
			const operatorTotalEntry = await workStationCollection
				.aggregate([
					{
						$unwind: "$operator",
					},
					{
						$unwind: "$operator.entry",
					},
					{
						$match: {
							"operator.entry.reportDate": date,
						},
					},
					{
						$group: {
							_id: {
								date: "$operator.entry.reportDate",
							},
							operatorTotalEntry: {
								$sum: "$operator.entry.entry",
							},
						},
					},
				])
				.toArray();

			return operatorTotalEntry;
		};

		const getTotalEntryJail = async date => {
			const jailWarderTotalEntry = await workStationCollection
				.aggregate([
					{
						$unwind: "$jailWarder",
					},
					{
						$unwind: "$jailWarder.entry",
					},
					{
						$match: {
							"jailWarder.entry.reportDate": date,
						},
					},
					{
						$group: {
							_id: {
								date: "$jailWarder.entry.reportDate",
							},
							jailWarderTotalEntry: {
								$sum: "$jailWarder.entry.number",
							},
						},
					},
				])
				.toArray();
			return jailWarderTotalEntry;
		};

		const getTotalReleaseOperator = async date => {
			const operatorTotalRelease = await workStationCollection
				.aggregate([
					{
						$unwind: "$operator",
					},
					{
						$unwind: "$operator.release",
					},
					{
						$match: {
							"operator.release.reportDate": date,
						},
					},
					{
						$group: {
							_id: {
								date: "$operator.release.reportDate",
							},
							operatorTotalRelease: {
								$sum: "$operator.release.release",
							},
						},
					},
				])
				.toArray();

			return operatorTotalRelease;
		};

		const getTotalReleaseJail = async date => {
			const jailWarderTotalRelease = await workStationCollection
				.aggregate([
					{
						$unwind: "$jailWarder",
					},
					{
						$unwind: "$jailWarder.release",
					},
					{
						$match: {
							"jailWarder.release.reportDate": date,
						},
					},
					{
						$group: {
							_id: {
								date: "jailWarder.release.reportDate",
							},
							jailWarderTotalRelease: {
								$sum: "$jailWarder.release.number",
							},
						},
					},
				])
				.toArray();

			return jailWarderTotalRelease;
		};
		// API ###############

		app.get(`/single-user`, async (req, res) => {
			const email = req.query.email;
			const query = { email };

			const singleUser = await userCollection.findOne(query);
			res.send(singleUser);
		});

		app.get("/get-all-users", async (req, res) => {
			const skip = req.query?.skip;
			const limit = req.query?.limit;

			const query = { role: { $ne: "admin" } };
			const allUser = await userCollection
				.find(query)
				.skip(parseInt(skip))
				.limit(parseInt(limit))
				.toArray();
			res.send(allUser);
		});

		app.get("/get-total-user-number", async (req, res) => {
			const query = { role: { $ne: "admin" } };
			const totalUser = await userCollection.countDocuments(query);
			res.send({ totalUser });
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

				reportDate,
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
								$each: [{ entry, reportDate }],
								$position: 0,
							},
							"operator.$.release": {
								$each: [{ release, reportDate }],
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
							$each: [
								{
									number: parseInt(jailWarderEntry),
									reportDate,
								},
							],
							$position: 0,
						},
						[`jailWarder.release`]: {
							$each: [
								{
									number: parseInt(jailWarderRelease),
									reportDate,
								},
							],
							$position: 0,
						},
						[`lockup`]: {
							$each: [{ number: parseInt(lockup), reportDate }],
							$position: 0,
						},
						[`active`]: {
							$each: [{ number: parseInt(active), reportDate }],
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

			res.send({});
		});

		app.get("/daily-report", async (req, res) => {
			const date = req.query.date;



			const totalEntryOperator = await getTotalEntryOperator(
				date
			);
			const totalEntryJailWarder = await getTotalEntryJail(date);
			const totalReleaseOperator = await getTotalReleaseOperator(date);
			const totalReleaseJailWarder = await getTotalReleaseJail(date);

			const totalEntry =
				totalEntryOperator?.[0]?.operatorTotalEntry +
				totalEntryJailWarder?.[0]?.jailWarderTotalEntry;
			const totalRelease =
				totalReleaseOperator?.[0]?.operatorTotalRelease +
				totalReleaseJailWarder?.[0]?.jailWarderTotalRelease;

			res.send({ totalEntry, totalRelease });
		});

		app.get("/all-report-date", async (req, res) => {
			const query = { role: { $ne: "admin" } };
			const result = await workStationCollection.find(query).toArray()

			console.log(result)
			res.send(result);
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
