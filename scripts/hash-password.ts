import bcrypt from "bcryptjs";

// Utilidad de línea de comandos para generar el valor de ADMIN_PASSWORD_HASH
// sin tener que escribir ni guardar el password en claro en ningún fichero.
// Uso: npm run hash-password -- "mi-password"
const password = process.argv[2];
if (!password) {
  console.error('Uso: npm run hash-password -- "mi-password"');
  process.exit(1);
}

bcrypt.hash(password, 10).then((hash) => {
  console.log(hash);
});
