import { generateKeyPair, exportJWK } from "jose";
import { randomBytes } from "crypto";

// Function to create JWKS and append to .env file
async function createJWKS() {
  const jwks: any = { keys: [] };

  for (let i = 0; i < 3; i++) {
    // Generate a new key pair
    // const alg = "ES256";
    // const { publicKey, privateKey } = await generateKeyPair(alg, {
    //   extractable: true,
    // });
    // // Export the key pair as a JWK
    // const jwk = await exportJWK(privateKey);
    // jwk.kid = randomBytes(16).toString("hex");
    // jwk.alg = alg;
    // jwks.keys.push(jwk);

    // TODO: replace this ASAP if in prod
    let res = await fetch(
      "https://mkjwk.org/jwk/ec?alg=ES256&use=sig&gen=sha256&crv=P-256",
    );
    let jwk_res = await res.json();
    let jwk = jwk_res.jwk;
    console.log("PRIVATE_KEY_" + (i + 1) + "=" + JSON.stringify(jwk));
  }
}

// Execute the function
createJWKS().catch(console.error);
