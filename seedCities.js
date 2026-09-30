import mongoose from "mongoose";
import dotenv from "dotenv";
import Community from "./src/models/Community.js";

dotenv.config();

// Adds a city-level Community anchor for (almost) every Nigerian state,
// using each state's best-known major city — so "Create Community" has a
// real country's worth of cities to pick from, not just Abuja.
//
// Purely additive: unlike seedCommunities.js, this never deletes anything.
// It skips any name that already exists (case-insensitively), so it's safe
// to run again later — e.g. after adding a state that was missed.
const CITIES = [
  "Umuahia", // Abia
  "Yola", // Adamawa
  "Uyo", // Akwa Ibom
  "Awka", // Anambra
  "Bauchi", // Bauchi
  "Yenagoa", // Bayelsa
  "Makurdi", // Benue
  "Maiduguri", // Borno
  "Calabar", // Cross River
  "Asaba", // Delta
  "Abakaliki", // Ebonyi
  "Benin City", // Edo
  "Ado-Ekiti", // Ekiti
  "Enugu", // Enugu
  "Gombe", // Gombe
  "Owerri", // Imo
  "Dutse", // Jigawa
  "Kaduna", // Kaduna
  "Kano", // Kano
  "Katsina", // Katsina
  "Birnin Kebbi", // Kebbi
  "Lokoja", // Kogi
  "Ilorin", // Kwara
  "Lagos", // Lagos
  "Lafia", // Nasarawa
  "Minna", // Niger
  "Abeokuta", // Ogun
  "Akure", // Ondo
  "Osogbo", // Osun
  "Ibadan", // Oyo
  "Jos", // Plateau
  "Port Harcourt", // Rivers
  "Sokoto", // Sokoto
  "Jalingo", // Taraba
  "Damaturu", // Yobe
  "Gusau", // Zamfara
  // Abuja (FCT) already exists from seedCommunities.js
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected for seeding...");

    const existingCities = await Community.find({ level: "city" }).select(
      "name",
    );
    const existingNames = new Set(
      existingCities.map((c) => c.name.trim().toLowerCase()),
    );

    const toCreate = CITIES.filter(
      (name) => !existingNames.has(name.toLowerCase()),
    );

    if (toCreate.length === 0) {
      console.log("Every city is already seeded — nothing to add.");
    } else {
      const created = await Promise.all(
        toCreate.map((name) =>
          Community.create({
            name,
            level: "city",
            parent: null,
            status: "active",
            foundedBy: null,
          }),
        ),
      );
      console.log(`Added ${created.length} cities:`, created.map((c) => c.name));
    }

    const skipped = CITIES.filter((name) => existingNames.has(name.toLowerCase()));
    if (skipped.length > 0) {
      console.log(`Already existed, skipped: ${skipped.join(", ")}`);
    }

    await mongoose.disconnect();
    console.log("Done. Disconnected.");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
};

seed();
