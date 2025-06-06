import mongoose from "mongoose";


// const password = encodeURIComponent('8870_Chitra');
const connectDB = async () => {
	try {
		const conn = await mongoose.connect(process.env.MONGO_URI||"mongodb+srv://bhogyaannr:8870_Chitra@cluster0.7jouf56.mongodb.net/NR_BLOG?retryWrites=true&w=majority&appName=Cluster0", {
		
			useNewUrlParser: true,
			useUnifiedTopology: true,
		});

		console.log(`MongoDB Connected: ${conn.connection.host}`);
	} catch (error) {
		console.error(`Error: ${error.message}`);
		process.exit(1);
	}
};

export default connectDB;
