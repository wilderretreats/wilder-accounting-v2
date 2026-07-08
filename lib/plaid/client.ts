import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { getEnv } from "@/lib/env";

let cachedClient: PlaidApi | null = null;

/** Plaid API client, configured from env. Starts in sandbox per PLAID_ENV. */
export function getPlaidClient(): PlaidApi {
  if (cachedClient) return cachedClient;

  const env = getEnv();
  const configuration = new Configuration({
    basePath: PlaidEnvironments[env.PLAID_ENV],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": env.PLAID_CLIENT_ID,
        "PLAID-SECRET": env.PLAID_SECRET,
      },
    },
  });

  cachedClient = new PlaidApi(configuration);
  return cachedClient;
}
