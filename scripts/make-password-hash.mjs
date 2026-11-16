#!/usr/bin/env node
/**
 * Build a password hash this app accepts, and print the one SQL line that installs it.
 *
 *   node scripts/make-password-hash.mjs --email me@example.com
 *   node scripts/make-password-hash.mjs --email me@example.com --password 'MyPass123'
 *
 * Zero dependencies on purpose: it must run on the cPanel host, where `node_modules` is
 * removed after a build and mysql2 is therefore unavailable. The output is a single
 * `UPDATE users ...` statement to paste into phpMyAdmin → SQL.
 *
 * Why this exists: `POST /api/auth/login` answers 401 both when the email is missing and when
 * the stored hash uses a format the app cannot verify (e.g. `$2y$` bcrypt written by an older
 * version). Neither case is fixable from the login form; both are fixable here.
 */
import crypto from "node:crypto";
import readline from "node:readline";

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return "";
  // `--email` may legitimately be empty, and a password may start with "--".
  return process.argv[i + 1] ?? "";
};

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Turns off terminal echo: the password never lands in scrollback or shell history.
function askHidden(question) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("no tty"));
      return;
    }
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let value = "";
    const cleanup = () => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
    };
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n" || char === "\u0004") {
          cleanup();
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          cleanup();
          process.exit(130);
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };
    stdin.on("data", onData);
  });
}

async function resolveEmail() {
  const given = arg("email").trim().toLowerCase();
  if (given) return given;
  if (!process.stdin.isTTY) {
    console.error("مثال: node scripts/make-password-hash.mjs --email me@example.com");
    process.exit(2);
  }
  const answer = (await ask("ایمیل حساب: ")).trim().toLowerCase();
  if (!answer) process.exit(2);
  return answer;
}

const email = await resolveEmail();
if (!email.includes("@")) {
  console.error("ایمیل معتبر نیست.");
  process.exit(2);
}

async function readPassword() {
  const given = arg("password");
  if (given) return given;

  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8").trim();
  }

  return (await askHidden("رمز عبور جدید (تایپ نمی‌شود): ")).trim();
}

const password = await readPassword();
if (password.length < 8) {
  console.error("رمز باید حداقل ۸ کاراکتر باشد.");
  process.exit(2);
}

// Same format as hashPassword() in src/lib/auth.server.ts: scrypt$<salt>$<hex>
const salt = crypto.randomBytes(16).toString("hex");
const hash = `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString("hex")}`;

// Self-check against the same rules verifyPassword() uses, so we never hand over a dead hash.
const [prefix, checkSalt, checkHex] = hash.split("$");
const recomputed = crypto.scryptSync(password, checkSalt, Buffer.from(checkHex, "hex").length);
const selfCheck =
  prefix === "scrypt" && crypto.timingSafeEqual(Buffer.from(checkHex, "hex"), recomputed);

if (!selfCheck) {
  console.error("self-check failed — the generated hash would not verify. Nothing written.");
  process.exit(1);
}

const escapedEmail = email.replace(/'/g, "''");

console.log("");
console.log(`email: ${email}`);
console.log(`hash : ${hash}`);
console.log(
  `length: ${hash.length} کاراکتر (ستون password_hash باید حداقل varchar(${hash.length}) باشد)`,
);
console.log("");
console.log("این یک خط را در phpMyAdmin → دیتابیس → تب SQL بچسبانید و Go بزنید:");
console.log("");
console.log(`UPDATE users SET password_hash = '${hash}' WHERE LOWER(email) = '${escapedEmail}';`);
console.log("");
console.log("بعد از اجرا، این را هم بزنید تا مطمئن شوید یک ردیف تغییر کرد:");
console.log("");
console.log(
  `SELECT id, email, role, LEFT(password_hash, 7) AS prefix FROM users WHERE LOWER(email) = '${escapedEmail}';`,
);
console.log("");
console.log("اگر SELECT خالی بود، یعنی حساب با این ایمیل در این دیتابیس وجود ندارد —");
console.log("در آن صورت از صفحهٔ ثبت‌نام اپ حساب بسازید، نه از این اسکریپت.");
console.log("");
