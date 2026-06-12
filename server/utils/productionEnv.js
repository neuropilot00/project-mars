'use strict';

const MIN_SECRET_LENGTH = 32;
const WEAK_SECRET_PATTERN = /(admin|change[-_ ]?me|default|dev|dummy|example|password|secret|test|todo|weak|your[-_ ]?secret|1234)/i;

function validateStrongSecret(name, value) {
  const problems = [];
  if (!value) {
    problems.push(`${name} is not set`);
    return problems;
  }

  const secret = String(value);
  if (secret.length < MIN_SECRET_LENGTH) {
    problems.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  if (WEAK_SECRET_PATTERN.test(secret)) {
    problems.push(`${name} contains a weak default pattern`);
  }
  if (/^(.)\1+$/.test(secret)) {
    problems.push(`${name} must not be a repeated single character`);
  }

  return problems;
}

function validateProductionEnv(env = process.env) {
  const fatal = [
    ...validateStrongSecret('JWT_SECRET', env.JWT_SECRET),
    ...validateStrongSecret('ADMIN_SECRET', env.ADMIN_SECRET),
  ];

  if (!env.DATABASE_URL) fatal.push('DATABASE_URL is not set');

  return fatal;
}

module.exports = {
  MIN_SECRET_LENGTH,
  validateStrongSecret,
  validateProductionEnv,
};
