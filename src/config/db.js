import mongoose from "mongoose"; // Import the mongoose library for MongoDB interactions

// mongoose talks to the database and connects to it

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${connection.connection.host}`); // Log the successful connection to the console
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1); // Exit the process with failure
  }
};

// connectDB(); // Call the connectDB function to establish the database connection

export default connectDB; // Export the connectDB function for use in other parts of the application
