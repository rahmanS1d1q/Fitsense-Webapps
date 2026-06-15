import bcrypt from "bcryptjs";

const password = "SuperAdmin123";
const hash = bcrypt.hashSync(password, 10);
console.log("Password:", password);
console.log("Hash:", hash);
console.log("\nSQL:");
console.log(
  `UPDATE users SET password_hash = '${hash}' WHERE email = 'superadmin@fitsense.com';`,
);
