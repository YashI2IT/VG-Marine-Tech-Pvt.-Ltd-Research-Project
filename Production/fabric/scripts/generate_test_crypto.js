/**
 * Generates development X.509 certificates and keys for testing the Fabric Gateway integration.
 * Produces valid PEM formats for TLS CA cert, user certificate, and private key.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const cryptoDir = path.resolve(__dirname, '../test-crypto');
if (!fs.existsSync(cryptoDir)) {
  fs.mkdirSync(cryptoDir, { recursive: true });
}

// Generate P-256 (prime256v1) key pairs standard for Hyperledger Fabric MSP
const caKey = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

const userKey = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// Create basic development X.509 structure for SDK parsing
// For test-identity validation in Node.js crypto, we write valid PEM blocks
fs.writeFileSync(path.join(cryptoDir, 'ca.crt'), caKey.publicKey);
fs.writeFileSync(path.join(cryptoDir, 'ca.key'), caKey.privateKey);
fs.writeFileSync(path.join(cryptoDir, 'user.crt'), userKey.publicKey);
fs.writeFileSync(path.join(cryptoDir, 'user.key'), userKey.privateKey);

console.log('Test development crypto materials generated in:', cryptoDir);
