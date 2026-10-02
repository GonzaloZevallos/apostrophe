# Accounts

Businesses, their users, and the only ways in: an invitation and a login. Every other
capability reads one thing from here, the business of the user asking, and serves that
business alone (ADR-0004).

## Jobs

**When** a friend wants to use the app for their own business, **I want** to hand them a
link that opens a business of their own, **so I can** add them without seeing or touching
anything they will record.

**When** I sell together with a partner, **I want** to invite them into my business,
**so we** both record sales on the same books.

**When** I open the app on my phone, **I want** to log in once and stay in, **so I can**
record a sale in seconds, while nobody else on the network or who guesses at passwords
gets in.

Success criteria:

1. Nothing of one business is reachable from another, through any route: by id it does not
   exist (404), in a list it is absent.
2. Nobody gets in without an invitation; each invitation lets one person in, once, within
   seven days.
3. Repeated wrong passwords stop working for a while, and nothing in the answers tells
   which emails have a user.

## Behaviour

- **New-business invitation**: printed by `scripts/invite-business.sh`. Accepting it takes
  a business name, an email and a password, and opens the business with that user in it.
- **Join invitation**: any user creates one from the app (`POST /invitations`). Accepting
  it takes an email and a password and adds the user to the inviting business; a business
  name sent along is ignored.
- Looking up an invitation tells its kind, the business it leads to (join only) and when
  it expires. An unknown, used or expired invitation is not found.
- **Email**: trimmed and lowercased; one user per email across the whole installation.
- **Password**: at least 10 characters; stored only as a hash.
- **Login**: email and password answer a session that lasts 30 days, as a cookie and a
  token. A wrong password and an unknown email get the same answer.
- **Brake**: five failures in a row for an email lock it for 15 minutes, even for the
  right password; a success resets the count.
- `GET /auth/me` answers the user's email and their business's name.
- Logging out drops the cookie.

## Out of scope

- Changing or resetting a password from the app; removing a user.
- Exporting or deleting a business: part of publishing the app on the internet.
- Roles within a business.
