import mongoose from "mongoose";
import dotenv from "dotenv";
import Community from "./src/models/Community.js";

dotenv.config();

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected for seeding...");

    // Clear existing community data (careful — only do this in dev)
    await Community.deleteMany({});
    console.log("Cleared existing communities.");

    // 1. Create the city-level anchor
    const abuja = await Community.create({
      name: "Abuja",
      level: "city",
      parent: null,
      status: "active",
      foundedBy: null,
    });

    // 2. Create a few demo communities under Abuja
    const demoCommunities = ["Wuse", "Wuse 2", "Garki", "Gwarinpa", "Maitama"];

    const created = await Promise.all(
      demoCommunities.map((name) =>
        Community.create({
          name,
          level: "community",
          parent: abuja._id,
          status: "unrepresented", // no rep assigned yet — will flip to "active" on approval
          foundedBy: null,
        }),
      ),
    );

    console.log(`Seeded city: ${abuja.name}`);
    console.log(
      `Seeded ${created.length} communities:`,
      created.map((c) => c.name),
    );

    await mongoose.disconnect();
    console.log("Done. Disconnected.");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
};

seed();
