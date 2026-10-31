# Project Overview

Create a web application using **Vite, React, TypeScript, Tailwind, and react-router-dom**.

## Application Flow

1. Display a **Landing Page**
2. Use **CTA buttons (Login / Register)** to authenticate users
3. After authentication, display the **Home Page**
4. If a valid token already exists, skip the landing page and go directly to Home

---

## Core Requirements

### Responsive Design

- Mobile-first approach
- Fully responsive for tablet and desktop

---

## Landing Page

- Contains:
  - Hero section
  - Benefits section
  - Additional relevant sections
- Content stored in a JSON configuration file
- Render sections dynamically from JSON

### CTA Behavior

- Login → Navigate to Login page
- Register → Navigate to Registration page

---

## Tenant Management

Implement a TenantContext to manage tenant data.

### Fetch Tenant

GET https://auth.magicrunez.com/tenant/
Headers:
X-Tenant-ID: <tenant-id>

### Response

```json
{
  "tenant": {
    "id": 68,
    "name": "Kaylen",
    "uuid": "d2c5b2f0-f5c7-11f0-937d-1a220d8ac2c9",
    "owner": "kaylen",
    "description": null,
    "date_created": "2026-01-20 07:18:18.000000"
  },
  "settings": {
    "SettingName": "Value"
  },
  "properties": [
    {
      "name": "accessElfApiKey",
      "value": ""
    },
    {
      "name": "example",
      "value": "value"
    },
    {
      "name": "returnURL",
      "value": ""
    }
  ]
}
```

---

## Authentication Management

Create an AuthContext:

- Stores user + token
- Exposes a hook

---

## Token Validation

GET https://auth.magicrunez.com/validate
Headers:
X-Tenant-ID: <tenant-id>
Authorization: Bearer <token>

### Response (same as login)

---

## Login

POST https://auth.magicrunez.com/login

{
"email": <email>,
"password": <password>
}

### Response

This response is use multiple times and can have its own standard type.

```json
{
  "token": "eyJhbG...25zWARW1zznIak",
  "refreshToken": "eyJhbGciO...8YlN1_3CY3DU",
  "profile": {
    "user": {
      "id": 41,
      "email": "cairnswm@gmail.com",
      "active": 1,
      "avatar": null,
      "lastname": "Cairns",
      "username": "cairnswm",
      "firstname": "William",
      "tenant_id": "005bf09f-5007-11f1-8e4b-00505661e513",
      "date_created": "2026-05-15 04:53:49.000000"
    },
    "roles": [
      {
        "id": 36,
        "name": "Admin",
        "description": null,
        "permissions": [
          {
            "id": 17,
            "name": "Admin",
            "value": 1
          }
        ]
      }
    ],
    "properties": [
      {
        "id": 290,
        "name": "Property",
        "value": "Property Value"
      }
    ],
    "user_permissions": [
      {
        "id": 14,
        "name": "Electrical",
        "value": 1
      }
    ]
  }
}
```

---

## Registration

POST https://auth.magicrunez.com/register

{
"email": "newuser9@example.com",
"password": "securepassword2",
"username": "newuser9",
"firstname": "John9",
"lastname": "Doe9",
"avatar": null,
"active": 1
}

### Response

(Same as Login)

---

## Forgot Password

Add a **Forgot Password** entry point on both:

- Login page
- Registration page

Selecting **Forgot Password** should open a form similar to Login where the user enters their email.

POST https://auth.magicrunez.com/forgot
Headers:
Content-Type: application/json
X-Tenant-ID: <tenant-id from .env>

{
"email": <email>
}

### Forgot Password Response

```json
{
  "message": "If your email is registered with us we will have sent you an email to update your password"
}
```

Display the returned message to the user.

---

## Reset Password

Add a route:

- /reset?code=<reset force key>

The Reset page must:

- Read the reset code from the query string
- Show a form with:
  - New password
  - Confirm password
- Validate that both passwords match before submission

Before allowing reset, validate the reset key status:

GET https://auth.magicrunez.com/forgot?code=<reset force key>
Headers:
Content-Type: application/json
X-Tenant-ID: <tenant-id from .env>

Response:

```json
{
  "used": 0
}
```

Only allow password reset when used is 0. If used is 1, show an invalid/expired/already-used reset message and block submission.

Submit reset:

POST https://auth.magicrunez.com/forgot/reset
Headers:
Content-Type: application/json
X-Tenant-ID: <tenant-id from .env>

{
"forcekey": <reset force key>,
"new_password": <new password>
}

If reset succeeds, the API returns the same payload shape as /login. Use that response to immediately authenticate the user and update AuthContext with the latest token/profile data.

The reset code must not be reusable after success.

---

## Error Handling

Display errors using an Alert component:

- Auto-dismiss after 3 seconds

### Possible Errors

{
"error": "Authentication failed",
"message": "Invalid or malformed token"
}

Other messages:

- Token has expired, Please log in again
- Invalid username or password

---

## Routing Rules

- No token → Landing Page
- Valid token → Home Page
- Invalid token → Login Page with error
- Login CTA → Login Page
- Register CTA → Registration Page
- Forgot Password from Login/Register → Forgot Password Page
- /reset route must accept the code query parameter and enforce one-time use

---

## Pages

- Landing Page
- Login Page
- Registration Page
- Forgot Password Page
- Reset Password Page
- Home Page
- Profile Page

---

## Home Page Layout

The Home Page must include a **Header** and a **Footer**.

### Header

- **Application name** displayed on the left
- **Placeholder favicon** (use a generic icon or placeholder image) displayed alongside the application name
- Clicking on the Application Name or Fav Icon should return you to the home screen
- **User menu** on the right, labelled with the authenticated user's full name (firstname + lastname)
  - Clicking the user name opens a **dropdown menu** containing:
    - **Profile** — navigates to the Profile Page
    - **Logout** — clears all auth tokens and returns to the Landing Page

### Logout Behaviour

- Clear the token from:
  - AuthContext state
  - `localStorage`
- Redirect the user to the Landing Page

### Footer

- Display a simple footer (e.g. application name + copyright year)

---

## Profile Page

- Accessible from the user dropdown menu in the Header
- Displays the authenticated user's details in **read-only** format, including:
  - First name
  - Last name
  - Email
  - Username
  - Roles
  - Date created
- No editing functionality at this stage

---

## Environment Variables

MAGICSTACK_AUTH_API=https://auth.magicrunez.com
MAGICSTACK_IMAGINARY_API=https://imaginary.magicrunez.com
MAGICSTACK_FILES_API=https://files.magicrunez.com

TENANT_ID=<tenant-id>

---

## Branding

- Application Name: TBD
- Colors: TBD
- Description: TBD
