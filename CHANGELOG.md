# [1.6.0](https://github.com/michaelshumshum/url-shortener-mcp/compare/v1.5.0...v1.6.0) (2026-04-02)


### Features

* **bin:** add --create-user flag to create a user without starting the server ([acd37d5](https://github.com/michaelshumshum/url-shortener-mcp/commit/acd37d539aac57b5c71b6689710bcd0d0c45c6f5))
* **mcp:** narrow search_urls response to tag and shortUrl only ([1cc8c73](https://github.com/michaelshumshum/url-shortener-mcp/commit/1cc8c7371c7a5a623074d33c29f1265789377bda))

# [1.5.0](https://github.com/michaelshumshum/url-shortener-mcp/compare/v1.4.2...v1.5.0) (2026-04-01)


### Features

* **api:** add tag support and GET /urls/search endpoint ([6db99f8](https://github.com/michaelshumshum/url-shortener-mcp/commit/6db99f8e7c1264fc60223830238ed2aad64072b4))
* **mcp:** add get_stats tool ([b2615f0](https://github.com/michaelshumshum/url-shortener-mcp/commit/b2615f0e196e36c096b4d97afa649a527a33ff17))
* **mcp:** add search_urls tool and tag support to shorten_url ([67318e0](https://github.com/michaelshumshum/url-shortener-mcp/commit/67318e0ef51c5a18cc5d5db3806ebccdb612168f))
* **mcp:** extend sampling to suggest slug and tag together ([f3e73ba](https://github.com/michaelshumshum/url-shortener-mcp/commit/f3e73ba963ebf7462eda706d8872259cb2e72e1d))
* **url:** add tag field for URL purpose annotation ([c4945fd](https://github.com/michaelshumshum/url-shortener-mcp/commit/c4945fd4eb16ee96610481d1726803fe73b7170b))
* **url:** track estimatedTokensSaved per shortened URL ([a3545de](https://github.com/michaelshumshum/url-shortener-mcp/commit/a3545de14a51c83525d44cb24ec74da9ad0a0b4f))

## [1.4.2](https://github.com/michaelshumshum/url-shortener-mcp/compare/v1.4.1...v1.4.2) (2026-03-30)


### Bug Fixes

* **postinstall:** always run prisma generate regardless of git context ([2c45509](https://github.com/michaelshumshum/url-shortener-mcp/commit/2c455090ee463d7b0be35e5c98ded8786917b99b))
* **startup:** log migration stdout/stderr through logger ([3aa4da5](https://github.com/michaelshumshum/url-shortener-mcp/commit/3aa4da5f42a526b02561ef950c8124ba641af6c6))
* **startup:** run prisma migrations async inside main() ([23578cf](https://github.com/michaelshumshum/url-shortener-mcp/commit/23578cf4c7b404a570a65c21c7d1096cb43d9e53))
* **url:** delete record in deleteUrl service ([7b39112](https://github.com/michaelshumshum/url-shortener-mcp/commit/7b39112bffe3d760f545e60fa81a7dcff5c96212))
* **user:** use logger and drop no-op .then() in updateUserActivity ([a2c45ac](https://github.com/michaelshumshum/url-shortener-mcp/commit/a2c45ac3374f7eb21e7f344905fb25a62a88ef12))


### Performance Improvements

* **auth:** replace bulk user cache with per-entry TTL cache ([d498257](https://github.com/michaelshumshum/url-shortener-mcp/commit/d498257bb6d95c2b990430bd5fb536aec866b64c))

## [1.4.1](https://github.com/michaelshumshum/url-shortener-mcp/compare/v1.4.0...v1.4.1) (2026-03-29)


### Bug Fixes

* **config:** correct file include patterns in biome.json ([d168c56](https://github.com/michaelshumshum/url-shortener-mcp/commit/d168c56bb18b38acea528cf363e38f9bb588c6f2))

# [1.4.0](https://github.com/michaelshumshum/url-shortener-mcp/compare/v1.3.0...v1.4.0) (2026-03-28)


### Bug Fixes

* add type checking to scripts ([cbbe6f1](https://github.com/michaelshumshum/url-shortener-mcp/commit/cbbe6f11a50449a42a2aec245880033e7ed2fb94))
* correct service import ([30346cf](https://github.com/michaelshumshum/url-shortener-mcp/commit/30346cf57bd5962ae050458aad5efc60185fa60c))
* env boolean parsing ([7221982](https://github.com/michaelshumshum/url-shortener-mcp/commit/72219824aa6dedf12c1e27803020baa21535aa02))
* **release:** update release commit message formatting ([aba60e3](https://github.com/michaelshumshum/url-shortener-mcp/commit/aba60e39032b0123454ef89e63c48cb81adda1de))
* remove env console log ([71fee70](https://github.com/michaelshumshum/url-shortener-mcp/commit/71fee70de08ed3cd2bd5edba9ec81808c8ab5d6a))
* template strng release config ([c17116b](https://github.com/michaelshumshum/url-shortener-mcp/commit/c17116b6c7f7d41f865cbc8d8f5dae67af579922))
* update create-user script ([fafcbde](https://github.com/michaelshumshum/url-shortener-mcp/commit/fafcbdec98128a1dea244b28ec92ae8c61bfc41e))
* user User type in auth middleware ([d1ce900](https://github.com/michaelshumshum/url-shortener-mcp/commit/d1ce900f265983643cf4cc61923c70e3a9007525))


### Features

* **bin:** add --inactive-user-cutoff flag to flagMap ([734b50c](https://github.com/michaelshumshum/url-shortener-mcp/commit/734b50c36aea21f89202b6f2a0fb4232f6d4f24c))
* delete inactive users ([dcb4bb0](https://github.com/michaelshumshum/url-shortener-mcp/commit/dcb4bb04e6475ff79d4f66f9e21c708b7d5bcfb2))
* start all jobs ([05b5765](https://github.com/michaelshumshum/url-shortener-mcp/commit/05b5765527aa6d21d640e1e60477c14aa6f3436f))

# [1.3.0](https://github.com/michaelshumshum/url-shortener-mcp/compare/v1.2.1...v1.3.0) (2026-03-26)


### Bug Fixes

* resolve package paths for npx compatibility ([3a994be](https://github.com/michaelshumshum/url-shortener-mcp/commit/3a994be96b5b3b808a90bee7902526c51fa15fcf))
* update test setup to use libsql adapter ([1c40fba](https://github.com/michaelshumshum/url-shortener-mcp/commit/1c40fba2a0da5ef51d7b9394bbead367e0379efd))


### Features

* replace better-sqlite3 with libsql adapter ([9cde859](https://github.com/michaelshumshum/url-shortener-mcp/commit/9cde85981c4fbb49b6585b076921d8cacda6bbe6))

## [1.2.1](https://github.com/michaelshumshum/url-shortener-mcp/compare/v1.2.0...v1.2.1) (2026-03-26)


### Bug Fixes

* postinstall with npx ([d7cf07c](https://github.com/michaelshumshum/url-shortener-mcp/commit/d7cf07ca33084571a814d8046d2a42e259fe7f0d))
* test only on push, release never on push ([8a09dca](https://github.com/michaelshumshum/url-shortener-mcp/commit/8a09dcacf00172388da72165a0b8d6f95247326f))

# [1.2.0](https://github.com/michaelshumshum/url-shortener-mcp/compare/v1.1.6...v1.2.0) (2026-03-26)


### Bug Fixes

* initializing fix ([a17ac9d](https://github.com/michaelshumshum/url-shortener-mcp/commit/a17ac9d7c5e7c94af3ae17ee3fe1c3b492cdfa56))


### Features

* allow dispatching releases ([c9776dc](https://github.com/michaelshumshum/url-shortener-mcp/commit/c9776dcf9318e75ff76a7394c205b83fdca0adca))

## [1.1.6](https://github.com/michaelshumshum/url-shortener-mcp/compare/v1.1.5...v1.1.6) (2026-03-26)


### Bug Fixes

* url-shortener-mcp.js executable ([69f52ab](https://github.com/michaelshumshum/url-shortener-mcp/commit/69f52abc971c5b070d5974826941a9e94a689d4e))

## [1.1.5](https://github.com/michaelshumshum/url-shortener-mcp/compare/v1.1.4...v1.1.5) (2026-03-26)


### Bug Fixes

* resolve prisma binary via require.resolve for npx compatibility ([33656d0](https://github.com/michaelshumshum/url-shortener-mcp/commit/33656d0c55ae398da2b1580f99ee6a1854830244))

## [1.1.4](https://github.com/michaelshumshum/url-shortener-mcp/compare/v1.1.3...v1.1.4) (2026-03-26)


### Bug Fixes

* dynamically size API key box to fit key length ([ddfb9af](https://github.com/michaelshumshum/url-shortener-mcp/commit/ddfb9af1c2d2142ab9d37cc22dade5d61e534f06))

## [1.1.3](https://github.com/michaelshumshum/url-shortener-mcp/compare/v1.1.2...v1.1.3) (2026-03-26)


### Bug Fixes

* use 302 redirect instead of 301 to prevent browser caching ([b8a099b](https://github.com/michaelshumshum/url-shortener-mcp/commit/b8a099bae0c98837a651f3ba5779e9116266ef0a))

## [1.1.2](https://github.com/michaelshumshum/url-shortener-mcp/compare/v1.1.1...v1.1.2) (2026-03-26)


### Bug Fixes

* add helmet security headers ([371ef8c](https://github.com/michaelshumshum/url-shortener-mcp/commit/371ef8cc04fda5bc97851d94e78ae71b47f4d66d))

## [1.1.1](https://github.com/michaelshumshum/url-shortener-mcp/compare/v1.1.0...v1.1.1) (2026-03-26)


### Bug Fixes

* add rate limiting to MCP and redirect endpoints ([38c7895](https://github.com/michaelshumshum/url-shortener-mcp/commit/38c7895da9ca83faaf08aabd46c55473424ffbdc))
* restrict longUrl to http/https schemes only ([47f77e9](https://github.com/michaelshumshum/url-shortener-mcp/commit/47f77e9bf88fe6f6509ece1d49da49649f3b0c33))

# [1.1.0](https://github.com/michaelshumshum/url-shortener-mcp/compare/v1.0.0...v1.1.0) (2026-03-26)


### Features

* add bulk URL shortening ([c2fa3c1](https://github.com/michaelshumshum/url-shortener-mcp/commit/c2fa3c181f8b966ed83168f9de05157d71957fa5))

# 1.0.0 (2026-03-26)


### Bug Fixes

* lefthook commit-msg ([3bcb63e](https://github.com/michaelshumshum/url-shortener-mcp/commit/3bcb63e432a5f862c41a3e0ed0ff05d398270a66))
* list_urls inputSchema and ensureUniqueSlug jsdoc ([dd84d25](https://github.com/michaelshumshum/url-shortener-mcp/commit/dd84d2502eab735a4a5f117eee43b6a96d6863b4))
* register git hooks ([11934ce](https://github.com/michaelshumshum/url-shortener-mcp/commit/11934ceb56bf2c98588f13b3e85c097f5725bb14))
* remove test summary ([f036a03](https://github.com/michaelshumshum/url-shortener-mcp/commit/f036a0343636d6f4a610bcbea314e5c291c7208c))
* revert schema url field and make migration failure fatal ([7fe2464](https://github.com/michaelshumshum/url-shortener-mcp/commit/7fe246482c4d0d105ea2ed710d84c73edb8d6a5f))
* update lockfile after moving prisma to dependencies ([b92e21a](https://github.com/michaelshumshum/url-shortener-mcp/commit/b92e21a6e756e3b7f2f5c1a3a34cf8b543650124))
* use timing-safe comparison in verifyKey ([06825fc](https://github.com/michaelshumshum/url-shortener-mcp/commit/06825fc6631497c139b62ec3d297aca125a5ca7e))


### Features

* add CLI arg parsing for env var substitution via npx ([ce4eb0f](https://github.com/michaelshumshum/url-shortener-mcp/commit/ce4eb0f07b460a8d6148d96e48f21d227af9784d))
* add ENABLE_API and ENABLE_MCP env flags ([a33066a](https://github.com/michaelshumshum/url-shortener-mcp/commit/a33066a5be117a3345f8323b96a3c9c3abf71d90))
* add mcp resources, prompts, and sampling ([5a979c7](https://github.com/michaelshumshum/url-shortener-mcp/commit/5a979c760dc64c7c187d02286bf66367cc3fd8fd))
* add structured logger and align API/MCP logging ([035c841](https://github.com/michaelshumshum/url-shortener-mcp/commit/035c841bf0bebe5ccb73e175670d846b571d5cf4))
* align REST API to MCP tools ([53557bd](https://github.com/michaelshumshum/url-shortener-mcp/commit/53557bd5355aa44dc6a8db88d48329501d42c659))
* auto-create first user on startup if none exist ([57fa006](https://github.com/michaelshumshum/url-shortener-mcp/commit/57fa006d84a92e53f6ba4d97364e9b2d0533a8ce))
* error middleware ([6010957](https://github.com/michaelshumshum/url-shortener-mcp/commit/6010957095cbd77d1ce6f673c7b0cbba9abc30d9))
* init project ([e7e87e6](https://github.com/michaelshumshum/url-shortener-mcp/commit/e7e87e6677f82794c67a8f9584e8f56223e2526f))
* support npx distribution with bin entry and auto-migration ([5ed0acb](https://github.com/michaelshumshum/url-shortener-mcp/commit/5ed0acbef12be434ecaa56738276d2fe00e08621))
