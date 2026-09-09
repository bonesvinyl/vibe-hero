# Community leaderboard prototype

Run `node server/leaderboard.js` with Node 22.13+ (tested with Node 25). The default listener is localhost:8787. SQLite persists results in leaderboard.sqlite; VIBE_SCORE_DB changes that path. HOST and PORT configure the listener. Back up the database before migrating hosts.

POST /scores accepts one exported score record from the extension. GET /scores?videoId=ID&board=KEY returns the top 100 attempts for the exact recording, ruleset, chart hash, difficulty, play style and chord setting. The POST response supplies KEY. POST retries with the same ID are idempotent. Names are display labels, not authenticated identities. Scores are client-submitted and unverified; this is not a cheat-resistant competitive leaderboard. Rate limiting is per direct connection address and process; deploy behind suitable public ingress limits.

This service is built and tested locally, not hosted or connected to extension score saves. Public release still needs a hosting account, TLS, moderation/deletion controls and a decision about authenticated players. No account, cloud resource, or public endpoint has been created. Keep the default local binding while evaluating. The existing game saves scores locally without requiring this service.
