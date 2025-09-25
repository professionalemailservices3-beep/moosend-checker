# Email Authentication Checker

This is a simple web tool designed to check a domain's email authentication status (MX, SPF, DMARC) and generate the necessary DNS records for integration with Moosend.

---

### ## Live Site

**Check out the live tool here:** [https://moo-authenticator.netlify.app/](https://moo-authenticator.netlify.app/)

---

### ## Features

* **Authentication Status Check:** Instantly checks a domain for existing MX, SPF, DKIM and DMARC records.
* **Intelligent SPF Parsing:** Displays existing SPF records in a clean, easy-to-read format and detects if the Moosend value is already present.
* **Automated DKIM Lookup:** Provide your DKIM selector (defaults to `ms` for Moosend) and the tool will look up the full DKIM record value for you.
* **Dynamic Record Generation:** Generates the correct SPF, DKIM, and DMARC records based on what your domain needs.
    * Creates a new SPF record if one doesn't exist.
    * Merges the Moosend value into an existing SPF record.
    * Recommends a DMARC record if one is missing.
* **User-Friendly UI:** Includes a clean interface, a reset button, copy-to-clipboard functionality, and helpful tooltips.

---

### ## How to Run Locally

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/professionalemailservices3-beep/moosend-checker.git](https://github.com/professionalemailservices3-beep/moosend-checker.git)
    cd moosend-checker
    ```
2.  **Install Netlify CLI:**
    ```bash
    npm install netlify-cli -g
    ```
3.  **Run the development server:**
    ```bash
    netlify dev
    ```
4.  Open your browser to `http://localhost:8888`.