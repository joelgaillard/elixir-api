import User from "../models/user.js"

export const cleanUpDatabase = async function() {
  await Promise.all([
    User.deleteMany()
  ]);
};