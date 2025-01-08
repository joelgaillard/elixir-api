import Bar from "../models/bar.js";
import Cocktail from "../models/cocktail.js";
import User from "../models/user.js"

export const cleanUpDatabase = async function() {
  await Promise.all([
    Bar.deleteMany({}),
    Cocktail.deleteMany({}),
    User.deleteMany({}) 
  ]);
};