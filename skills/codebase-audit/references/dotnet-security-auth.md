# .NET Security: Authentication & Authorization

Security patterns for authentication, authorization, CSRF protection, and redirect validation in .NET 6+ applications.

## Table of Contents

- [Authentication Issues](#authentication-issues)
- [Authorization Issues](#authorization-issues)
- [CSRF Protection](#csrf-protection)
- [Open Redirect](#open-redirect)

## Authentication Issues

**Critical:** Missing or weak authentication allows unauthorized access.

### Detection Patterns

```bash
# Find JWT configuration
grep -rn "AddJwtBearer\|JwtSecurityToken" --include="*.cs" .

# Find Identity configuration
grep -rn "AddIdentity\|AddDefaultIdentity" --include="*.cs" .

# Find cookie authentication
grep -rn "AddCookie\|CookieAuthenticationOptions" --include="*.cs" .

# Check for weak password requirements
grep -rn "PasswordOptions\|RequireDigit.*false" --include="*.cs" .
```

### Vulnerable Code

```csharp
// ❌ Critical: Weak JWT validation
public void ConfigureServices(IServiceCollection services)
{
    services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = false, // Accepts any issuer
                ValidateAudience = false, // Accepts any audience
                ValidateLifetime = false, // Accepts expired tokens
                ValidateIssuerSigningKey = false // No signature validation
            };
        });
}

// ❌ Critical: Hardcoded JWT secret
public string GenerateToken(User user)
{
    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("my-secret-key")); // Weak key
    var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
    // Token generation
}

// ❌ High: Weak password requirements
public void ConfigureServices(IServiceCollection services)
{
    services.AddIdentity<ApplicationUser, IdentityRole>(options =>
    {
        options.Password.RequireDigit = false;
        options.Password.RequiredLength = 4; // Too short
        options.Password.RequireNonAlphanumeric = false;
        options.Password.RequireUppercase = false;
        options.Password.RequireLowercase = false;
    });
}

// ❌ High: Password stored in plain text
public async Task<bool> ValidateUser(string username, string password)
{
    var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == username);
    return user?.Password == password; // Plain text comparison
}

// ✓ Good: Proper JWT validation
public void ConfigureServices(IServiceCollection services)
{
    var key = Configuration["Jwt:Key"]; // From config
    var issuer = Configuration["Jwt:Issuer"];
    var audience = Configuration["Jwt:Audience"];

    services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = issuer,
                ValidAudience = audience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
                ClockSkew = TimeSpan.FromMinutes(5)
            };
        });
}

// ✓ Good: Strong password requirements
public void ConfigureServices(IServiceCollection services)
{
    services.AddIdentity<ApplicationUser, IdentityRole>(options =>
    {
        options.Password.RequireDigit = true;
        options.Password.RequiredLength = 12;
        options.Password.RequireNonAlphanumeric = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireLowercase = true;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    });
}

// ✓ Good: Identity with proper password hashing
public class AccountService
{
    private readonly UserManager<ApplicationUser> _userManager;

    public async Task<bool> ValidateUser(string username, string password)
    {
        var user = await _userManager.FindByNameAsync(username);
        if (user == null) return false;
        return await _userManager.CheckPasswordAsync(user, password);
    }
}
```

**When to Flag:**
- **Critical:** JWT validation disabled (ValidateIssuer/Audience/Lifetime = false)
- **Critical:** Hardcoded secrets in authentication code
- **Critical:** Plain text password storage
- **High:** Weak password requirements (<8 chars, no complexity)
- **High:** No account lockout policy

## Authorization Issues

**Critical:** Missing authorization checks allow privilege escalation.

### Detection Patterns

```bash
# Find controllers without [Authorize]
grep -l "Controller" --include="*Controller.cs" . | xargs grep -L "\[Authorize\]"

# Find public API endpoints
grep -rn "\[HttpGet\]\|\[HttpPost\]\|\[HttpPut\]\|\[HttpDelete\]" --include="*Controller.cs" .

# Check for AllowAnonymous on sensitive operations
grep -rn "\[AllowAnonymous\]" --include="*.cs" . | grep -i "delete\|update\|admin"

# Find authorization policies
grep -rn "AddAuthorization\|RequireRole\|RequireClaim" --include="*.cs" .
```

### Vulnerable Code

```csharp
// ❌ Critical: No authorization on controller
public class AdminController : ControllerBase
{
    [HttpDelete("users/{id}")] // Anyone can delete users
    public async Task<IActionResult> DeleteUser(int id)
    {
        await _userService.DeleteAsync(id);
        return NoContent();
    }
}

// ❌ Critical: AllowAnonymous on sensitive endpoint
[Authorize]
public class OrderController : ControllerBase
{
    [AllowAnonymous] // Bypasses authorization
    [HttpGet("admin/orders")]
    public async Task<IActionResult> GetAllOrders()
    {
        return Ok(await _orderService.GetAllAsync());
    }
}

// ❌ High: No resource-level authorization (IDOR vulnerability)
[Authorize]
public class OrderController : ControllerBase
{
    [HttpGet("{id}")]
    public async Task<IActionResult> GetOrder(int id)
    {
        var order = await _orderService.GetAsync(id);
        // No check if user owns this order
        return Ok(order);
    }
}

// ❌ High: Role check in code instead of attribute
[Authorize]
public class UserController : ControllerBase
{
    [HttpPost("promote")]
    public async Task<IActionResult> PromoteToAdmin(int userId)
    {
        if (User.Identity.Name == "admin") // Fragile authorization
        {
            await _userService.PromoteAsync(userId);
        }
        return Forbid();
    }
}

// ✓ Good: Authorize attribute on controller
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class AdminController : ControllerBase
{
    [Authorize(Roles = "Admin")]
    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        await _userService.DeleteAsync(id);
        return NoContent();
    }
}

// ✓ Good: Resource-level authorization
[Authorize]
public class OrderController : ControllerBase
{
    [HttpGet("{id}")]
    public async Task<IActionResult> GetOrder(int id)
    {
        var order = await _orderService.GetAsync(id);
        if (order == null) return NotFound();

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (order.UserId != userId && !User.IsInRole("Admin"))
        {
            return Forbid();
        }

        return Ok(order);
    }
}

// ✓ Good: Policy-based authorization
public void ConfigureServices(IServiceCollection services)
{
    services.AddAuthorization(options =>
    {
        options.AddPolicy("AdminOnly", policy =>
            policy.RequireRole("Admin"));

        options.AddPolicy("CanDeleteUsers", policy =>
            policy.RequireClaim("Permission", "DeleteUsers"));
    });
}

[Authorize(Policy = "AdminOnly")]
public class AdminController : ControllerBase
{
    [Authorize(Policy = "CanDeleteUsers")]
    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        await _userService.DeleteAsync(id);
        return NoContent();
    }
}
```

**When to Flag:**
- **Critical:** Controllers without `[Authorize]` attribute
- **Critical:** `[AllowAnonymous]` on admin/delete/sensitive endpoints
- **High:** No resource-level authorization (IDOR vulnerability)
- **High:** Role checks in code instead of attributes/policies
- **Important:** No authorization policies defined

## CSRF Protection

**High:** Missing CSRF protection allows attackers to forge requests.

### Detection Patterns

```bash
# Check for ValidateAntiForgeryToken
grep -rn "ValidateAntiForgeryToken\|AutoValidateAntiforgeryToken" --include="*.cs" .

# Find POST/PUT/DELETE without CSRF protection
grep -rn "\[HttpPost\]\|\[HttpPut\]\|\[HttpDelete\]" --include="*.cs" . | head -20

# Check for antiforgery configuration
grep -rn "AddAntiforgery\|AntiforgeryOptions" --include="*.cs" .
```

### Vulnerable Code

```csharp
// ❌ High: State-changing endpoint without CSRF protection
public class AccountController : Controller
{
    [HttpPost]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        // No [ValidateAntiForgeryToken]
        await _userService.ChangePasswordAsync(request);
        return Ok();
    }
}

// ❌ High: Disabled antiforgery validation
[IgnoreAntiforgeryToken]
[HttpPost]
public async Task<IActionResult> DeleteAccount(int id)
{
    await _userService.DeleteAsync(id);
    return Ok();
}

// ✓ Good: ValidateAntiForgeryToken on state-changing actions
public class AccountController : Controller
{
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        await _userService.ChangePasswordAsync(request);
        return Ok();
    }
}

// ✓ Good: Global antiforgery validation
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddControllersWithViews(options =>
        {
            options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
        });
    }
}

// ✓ Good: API with token-based auth (CSRF not needed)
[Authorize] // JWT/Bearer tokens are immune to CSRF
[ApiController]
public class OrderController : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderRequest request)
    {
        // Token-based auth, no CSRF needed
        var order = await _orderService.CreateAsync(request);
        return Ok(order);
    }
}
```

**When to Flag:**
- **High:** POST/PUT/DELETE in MVC controllers without `[ValidateAntiForgeryToken]`
- **High:** `[IgnoreAntiforgeryToken]` on state-changing actions
- **Minor:** APIs with cookie-based authentication (use tokens instead)
- **N/A:** REST APIs with JWT/Bearer auth (immune to CSRF)

## Open Redirect

**Important:** Unvalidated redirects allow phishing attacks.

### Detection Patterns

```bash
# Find Redirect calls with user input
grep -rn "Redirect(.*Request\|RedirectToAction.*returnUrl" --include="*.cs" .

# Find LocalRedirect
grep -rn "LocalRedirect" --include="*.cs" .

# Check for returnUrl parameter
grep -rn "returnUrl.*string\|redirectUrl.*string" --include="*.cs" .
```

### Vulnerable Code

```csharp
// ❌ High: Unvalidated redirect
[HttpPost]
public IActionResult Login(LoginRequest request, string returnUrl)
{
    if (_authService.ValidateUser(request))
    {
        return Redirect(returnUrl); // Can redirect to https://evil.com
    }
    return Unauthorized();
}

// ❌ High: RedirectToAction with external URL
public IActionResult ExternalLink(string url)
{
    return Redirect(url); // No validation
}

// ✓ Good: Validate redirect URL
[HttpPost]
public IActionResult Login(LoginRequest request, string returnUrl)
{
    if (_authService.ValidateUser(request))
    {
        if (Url.IsLocalUrl(returnUrl))
        {
            return Redirect(returnUrl);
        }
        return RedirectToAction("Index", "Home"); // Safe fallback
    }
    return Unauthorized();
}

// ✓ Good: Use LocalRedirect (throws if not local)
[HttpPost]
public IActionResult Login(LoginRequest request, string returnUrl)
{
    if (_authService.ValidateUser(request))
    {
        return LocalRedirect(returnUrl ?? "/"); // Must be local URL
    }
    return Unauthorized();
}

// ✓ Good: Whitelist allowed redirect domains
private bool IsAllowedRedirect(string url)
{
    var allowedDomains = new[] { "example.com", "app.example.com" };
    if (Uri.TryCreate(url, UriKind.Absolute, out var uri))
    {
        return allowedDomains.Contains(uri.Host, StringComparer.OrdinalIgnoreCase);
    }
    return false;
}
```

**When to Flag:**
- **High:** `Redirect()` with user-supplied URL without validation
- **Important:** `returnUrl` parameters without `Url.IsLocalUrl()` check
- **Minor:** Use `LocalRedirect()` instead of `Redirect()` for internal URLs


---

## Cross-Reference

For related security topics:
- Data security (SQL injection, deserialization): See [dotnet-security-data.md](dotnet-security-data.md)
- Cryptography and secrets: See [dotnet-security-crypto.md](dotnet-security-crypto.md)
- SQL injection in Entity Framework: See [entity-framework.md](entity-framework.md)
- General OWASP Top 10 patterns: See [owasp-top-10.md](owasp-top-10.md)
- Framework-level security: See [framework-patterns-dotnet.md](framework-patterns-dotnet.md)
