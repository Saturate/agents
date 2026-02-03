# .NET Security: Cryptography & Infrastructure

Security patterns for secrets management, cryptographic operations, and security headers in .NET 6+ applications.

## Table of Contents

- [Secrets Management](#secrets-management)
- [Cryptographic Failures](#cryptographic-failures)
- [Security Headers](#security-headers)

## Secrets Management

**Critical:** Hardcoded secrets in code or config expose credentials.

### Detection Patterns

```bash
# Find hardcoded passwords
grep -rn "password.*=.*\"" --include="*.cs" . -i | grep -v "Password.*{.*get"

# Find connection strings in code
grep -rn "Server=.*Password=\|Data Source=.*Password=" --include="*.cs" .

# Find API keys
grep -rn "api.*key.*=.*\"\|apikey.*=.*\"" --include="*.cs" . -i

# Check appsettings.json for secrets
grep -rn "Password\|ApiKey\|Secret" --include="appsettings*.json" .

# Find secrets in appsettings
find . -name "appsettings.json" -exec grep -H "Password\|ApiKey" {} \;
```

### Vulnerable Code

```csharp
// ❌ Critical: Hardcoded database password
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer("Server=prod-db;Database=MyApp;User=admin;Password=P@ssw0rd123"));
    }
}

// ❌ Critical: API key in code
public class PaymentService
{
    private const string StripeApiKey = "sk_live_51Hab..."; // EXPOSED

    public async Task<Payment> ProcessPayment(decimal amount)
    {
        var client = new StripeClient(StripeApiKey);
        // Process payment
    }
}

// ❌ Critical: Secrets in appsettings.json (committed to git)
// appsettings.json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=prod;Password=admin123" // EXPOSED
  },
  "Stripe": {
    "ApiKey": "sk_live_51Hab..." // EXPOSED
  }
}

// ✓ Good: User Secrets in development
// Right-click project → Manage User Secrets
// secrets.json (NOT in git)
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Password=dev123"
  }
}

// ✓ Good: Environment variables in production
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        var connectionString = Configuration.GetConnectionString("DefaultConnection");
        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(connectionString)); // From env vars
    }
}

// ✓ Good: Azure Key Vault
public class Program
{
    public static IHostBuilder CreateHostBuilder(string[] args) =>
        Host.CreateDefaultBuilder(args)
            .ConfigureAppConfiguration((context, config) =>
            {
                var builtConfig = config.Build();
                var keyVaultEndpoint = builtConfig["KeyVault:Endpoint"];

                if (!string.IsNullOrEmpty(keyVaultEndpoint))
                {
                    config.AddAzureKeyVault(
                        new Uri(keyVaultEndpoint),
                        new DefaultAzureCredential());
                }
            });
}

// ✓ Good: Configuration abstraction
public class StripeSettings
{
    public string ApiKey { get; set; }
}

public class PaymentService
{
    private readonly string _apiKey;

    public PaymentService(IOptions<StripeSettings> settings)
    {
        _apiKey = settings.Value.ApiKey; // From secure config
    }
}
```

**When to Flag:**
- **Critical:** Hardcoded passwords, API keys, or connection strings
- **Critical:** Secrets in `appsettings.json` or `appsettings.Production.json`
- **High:** Secrets committed to version control
- **Important:** Missing User Secrets in development
- **Important:** No Azure Key Vault or secret manager in production

## Cryptographic Failures

**High:** Weak cryptography or insecure random number generation.

### Detection Patterns

```bash
# Find weak hashing algorithms
grep -rn "MD5\.Create\|SHA1\.Create" --include="*.cs" .

# Find insecure Random
grep -rn "new Random()" --include="*.cs" . | grep -v "// test"

# Find DES/3DES usage
grep -rn "DES\|TripleDES" --include="*.cs" .

# Check for custom crypto
grep -rn "class.*:.*ICryptoTransform" --include="*.cs" .
```

### Vulnerable Code

```csharp
// ❌ Critical: MD5 for password hashing
public string HashPassword(string password)
{
    using var md5 = MD5.Create(); // Broken, fast to crack
    var hash = md5.ComputeHash(Encoding.UTF8.GetBytes(password));
    return Convert.ToBase64String(hash);
}

// ❌ Critical: SHA1 for security purposes
public string GenerateToken(string data)
{
    using var sha1 = SHA1.Create(); // Collision attacks exist
    var hash = sha1.ComputeHash(Encoding.UTF8.GetBytes(data));
    return BitConverter.ToString(hash);
}

// ❌ High: Insecure random for security tokens
public string GenerateResetToken()
{
    var random = new Random(); // Predictable, not cryptographically secure
    var token = new byte[32];
    random.NextBytes(token);
    return Convert.ToBase64String(token);
}

// ❌ High: DES encryption
public byte[] EncryptData(byte[] data, byte[] key)
{
    using var des = DES.Create(); // Broken, 56-bit key
    des.Key = key;
    return des.CreateEncryptor().TransformFinalBlock(data, 0, data.Length);
}

// ❌ High: Hardcoded encryption key
public string Encrypt(string plaintext)
{
    var key = Encoding.UTF8.GetBytes("my-secret-key-16"); // Static key
    // Encryption logic
}

// ✓ Good: Use ASP.NET Core Identity for password hashing
public class AccountService
{
    private readonly UserManager<ApplicationUser> _userManager;

    public async Task<IdentityResult> CreateUser(string username, string password)
    {
        var user = new ApplicationUser { UserName = username };
        return await _userManager.CreateAsync(user, password); // PBKDF2 by default
    }
}

// ✓ Good: SHA256/SHA512 for non-password hashing
public string HashData(string data)
{
    using var sha256 = SHA256.Create(); // Secure for integrity checks
    var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(data));
    return Convert.ToHexString(hash);
}

// ✓ Good: Cryptographically secure random
public string GenerateResetToken()
{
    var token = new byte[32];
    using var rng = RandomNumberGenerator.Create();
    rng.GetBytes(token);
    return Convert.ToBase64String(token);
}

// ✓ Good: AES encryption with proper key management
public byte[] EncryptData(byte[] data, byte[] key)
{
    using var aes = Aes.Create();
    aes.Key = key; // 256-bit key from secure storage
    aes.GenerateIV(); // Random IV for each encryption

    using var encryptor = aes.CreateEncryptor();
    return encryptor.TransformFinalBlock(data, 0, data.Length);
}
```

**When to Flag:**
- **Critical:** MD5 or SHA1 for password hashing
- **Critical:** `new Random()` for security tokens, IDs, or crypto
- **High:** DES or 3DES encryption
- **High:** Hardcoded encryption keys
- **Important:** Custom cryptography implementations

## Security Headers

**Important:** Missing security headers increase attack surface.

### Detection Patterns

```bash
# Check for security headers middleware
grep -rn "UseHsts\|UseHttpsRedirection" --include="*.cs" .

# Find CSP configuration
grep -rn "Content-Security-Policy\|X-Frame-Options" --include="*.cs" .

# Check for header configuration
grep -rn "app.Use.*Headers" --include="*.cs" .
```

### Vulnerable Code

```csharp
// ❌ Important: No security headers
public class Startup
{
    public void Configure(IApplicationBuilder app)
    {
        app.UseRouting();
        app.UseEndpoints(endpoints => endpoints.MapControllers());
        // No security headers
    }
}

// ✓ Good: Basic security headers
public class Startup
{
    public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
    {
        if (!env.IsDevelopment())
        {
            app.UseHsts(); // HTTP Strict Transport Security
            app.UseHttpsRedirection();
        }

        app.Use(async (context, next) =>
        {
            context.Response.Headers.Add("X-Content-Type-Options", "nosniff");
            context.Response.Headers.Add("X-Frame-Options", "DENY");
            context.Response.Headers.Add("X-XSS-Protection", "1; mode=block");
            context.Response.Headers.Add("Referrer-Policy", "no-referrer");
            context.Response.Headers.Add("Content-Security-Policy",
                "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:");

            await next();
        });

        app.UseRouting();
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseEndpoints(endpoints => endpoints.MapControllers());
    }
}

// ✓ Good: Use NWebsec library
public class Startup
{
    public void Configure(IApplicationBuilder app)
    {
        app.UseHsts(options => options.MaxAge(days: 365));
        app.UseXContentTypeOptions();
        app.UseXfo(options => options.Deny());
        app.UseXXssProtection(options => options.EnabledWithBlockMode());
        app.UseReferrerPolicy(options => options.NoReferrer());
        app.UseCsp(options => options
            .DefaultSources(s => s.Self())
            .ScriptSources(s => s.Self())
            .StyleSources(s => s.Self()));
    }
}
```

**When to Flag:**
- **Important:** Missing `UseHsts()` in production
- **Important:** No `X-Content-Type-Options: nosniff`
- **Important:** No `X-Frame-Options` (clickjacking protection)
- **Minor:** Missing Content Security Policy (CSP)

---


---

## Cross-Reference

For related security topics:
- Authentication and authorization: See [dotnet-security-auth.md](dotnet-security-auth.md)
- Data security (SQL injection, deserialization): See [dotnet-security-data.md](dotnet-security-data.md)
- SQL injection in Entity Framework: See [entity-framework.md](entity-framework.md)
- General OWASP Top 10 patterns: See [owasp-top-10.md](owasp-top-10.md)
- Framework-level security: See [framework-patterns-dotnet.md](framework-patterns-dotnet.md)
