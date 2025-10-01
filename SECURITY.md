# Security Policy

## Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability in mobx-vue-bridge, please report it privately.

### How to Report

1. **DO NOT** open a public GitHub issue for security vulnerabilities
2. Send an email to the maintainer with details:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: We'll acknowledge receipt within 24-48 hours
- **Initial Assessment**: We'll provide an initial assessment within 5 business days
- **Resolution Timeline**: Critical vulnerabilities will be addressed within 7 days, others within 30 days
- **Disclosure**: We'll coordinate responsible disclosure once a fix is available

### Scope

This security policy applies to:
- The core mobx-vue-bridge library
- Official examples and documentation
- Build and deployment scripts

Out of scope:
- Third-party dependencies (report to their maintainers)
- Applications using mobx-vue-bridge (unless the vulnerability is in our library)

## Security Best Practices

When using mobx-vue-bridge:

1. **Keep dependencies updated**: Regularly update Vue, MobX, and other dependencies
2. **Validate data**: Always validate data before passing to MobX observables
3. **Use allowDirectMutation carefully**: Consider security implications when allowing direct mutations
4. **Sanitize user input**: Never directly assign unsanitized user input to observable properties

Thank you for helping keep mobx-vue-bridge secure! 🔒