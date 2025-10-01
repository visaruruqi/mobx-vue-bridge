# Contributing to mobx-vue-bridge

Thank you for your interest in contributing to mobx-vue-bridge! 🎉

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/visaruruqi/mobx-vue-bridge.git
   cd mobx-vue-bridge
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run tests**
   ```bash
   npm test          # Run tests in watch mode
   npm run test:run  # Run tests once
   npm run test:coverage  # Run with coverage
   ```

## Code Style

- Use 2 spaces for indentation
- Follow existing code patterns and naming conventions
- Add JSDoc comments for public APIs
- Write tests for new features and bug fixes

## Testing

- All tests must pass before submitting a PR
- Add tests for new functionality
- Test files are located in the `tests/` directory
- Use descriptive test names that explain the behavior being tested

## Pull Request Process

1. **Fork** the repository
2. **Create a feature branch** from `main`
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** with clear, descriptive commits
4. **Add tests** for new functionality
5. **Run the test suite** to ensure nothing is broken
6. **Update documentation** if needed (README, CHANGELOG)
7. **Submit a pull request** with:
   - Clear description of changes
   - Link to any related issues
   - Screenshots/examples if applicable

## Commit Messages

Use clear, descriptive commit messages:
- `feat: add new feature`
- `fix: resolve bug with circular references`
- `docs: update README examples`
- `test: add tests for nested objects`
- `refactor: improve performance of deep proxy`

## Bug Reports

When reporting bugs, please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Vue version, MobX version, browser/Node.js)
- Minimal code example if possible

## Feature Requests

For new features:
- Explain the use case and why it's needed
- Provide examples of how it would be used
- Consider backward compatibility
- Discuss implementation approach

## Questions?

Feel free to open an issue for questions or join discussions in existing issues.

Thank you for contributing! 🚀