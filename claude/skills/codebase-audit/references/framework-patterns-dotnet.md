# .NET 6+ Framework Patterns

ASP.NET Core, dependency injection, async patterns, testing, and code quality anti-patterns for modern .NET applications.

## Table of Contents

- [Version Detection](#version-detection)
- [Blocking Async Calls](#blocking-async-calls)
- [Synchronous I/O Operations](#synchronous-io-operations)
- [Service Locator Anti-Pattern](#service-locator-anti-pattern)
- [Captive Dependencies](#captive-dependencies)
- [Improper HttpClient Instantiation](#improper-httpclient-instantiation)
- [Configuration Anti-Patterns](#configuration-anti-patterns)
- [Missing Health Checks](#missing-health-checks)
- [API Versioning Issues](#api-versioning-issues)
- [LINQ Inefficiencies](#linq-inefficiencies)
- [God Object Pattern](#god-object-pattern)
- [Static Cling](#static-cling)
- [Disabled Tests](#disabled-tests)
- [Warning Suppression](#warning-suppression)
- [Empty Catch Blocks](#empty-catch-blocks)
- [Catching Exception Base Class](#catching-exception-base-class)
- [Test Delays](#test-delays)
- [Project-Level Warning Suppression](#project-level-warning-suppression)
- [Async Void in Tests](#async-void-in-tests)
- [Roslyn Analyzer Integration](#roslyn-analyzer-integration)

## Version Detection

**Check .NET version in project files:**

```bash
# Find all .NET projects
find . -name "*.csproj" -o -name "*.sln"

# Check target framework
grep -r "<TargetFramework>" --include="*.csproj" .

# Check for .NET 6+
grep -rE "net(6|7|8|9)\.0" --include="*.csproj" .

# Check for global.json (SDK version pinning)
[ -f "global.json" ] && cat global.json

# Detect ASP.NET Core
grep -rn "WebApplication.CreateBuilder\|Microsoft.AspNetCore" --include="*.cs" .
```

**Framework versions:**
- `net6.0`, `net7.0`, `net8.0`, `net9.0` → Modern .NET ✓
- `netcoreapp3.1` → .NET Core 3.1 (EOL December 2022) ⚠️
- `net48`, `net472` → .NET Framework (legacy, Windows-only) ⚠️

## Blocking Async Calls

**Critical:** Blocking async operations causes thread pool starvation and deadlocks.

**Detection:**

```bash
# Find .Result and .Wait() calls (excluding test files)
grep -rn "\.Result\|\.Wait()" --include="*.cs" . | grep -v -i test | grep -v "\.WaitAsync"

# Find GetAwaiter().GetResult()
grep -rn "GetAwaiter()\.GetResult()" --include="*.cs" .
```

**Code Example:**

```csharp
// ❌ Bad: Blocking async call causes deadlocks
public class OrderController : ControllerBase
{
    public IActionResult GetOrder(int id)
    {
        var order = _orderService.GetOrderAsync(id).Result; // DEADLOCK RISK
        return Ok(order);
    }
}

// ❌ Bad: .Wait() blocks thread
public void ProcessOrders()
{
    var task = _orderService.ProcessAsync();
    task.Wait(); // Thread pool starvation
}

// ✓ Good: Async all the way
public class OrderController : ControllerBase
{
    public async Task<IActionResult> GetOrder(int id)
    {
        var order = await _orderService.GetOrderAsync(id);
        return Ok(order);
    }
}
```

**When to Flag:**
- **Critical:** In ASP.NET Core controllers, middleware, or hot paths
- **High:** In library code or business logic

**Exception:** Sometimes acceptable in Program.cs/Main methods or console apps.

## Synchronous I/O Operations

**Critical:** Synchronous file/network I/O blocks threads in ASP.NET Core.

**Detection:**

```bash
# Find synchronous file operations
grep -rn "File\.Read[^A]\|File\.Write[^A]\|File\.Open[^A]" --include="*.cs" . | grep -v "Async"

# Find synchronous stream operations
grep -rn "\.Read()\|\.Write()" --include="*.cs" . | grep -v "Async\|ReadAsync\|WriteAsync"

# Find synchronous network calls
grep -rn "WebClient\|HttpWebRequest" --include="*.cs" .
```

**Code Example:**

```csharp
// ❌ Bad: Blocking file I/O
public IActionResult UploadFile(IFormFile file)
{
    using var stream = File.Create(path);
    file.CopyTo(stream); // Blocks thread
    return Ok();
}

// ❌ Bad: Synchronous network call
public string GetData()
{
    var client = new WebClient();
    return client.DownloadString(url); // Blocks thread
}

// ✓ Good: Async file I/O
public async Task<IActionResult> UploadFile(IFormFile file)
{
    using var stream = File.Create(path);
    await file.CopyToAsync(stream);
    return Ok();
}

// ✓ Good: Async network call
public async Task<string> GetData()
{
    using var client = new HttpClient();
    return await client.GetStringAsync(url);
}
```

**When to Flag:**
- **Critical:** In ASP.NET Core request pipeline
- **High:** In any async method

## Service Locator Anti-Pattern

**High:** Directly requesting IServiceProvider hides dependencies and makes testing difficult.

**Detection:**

```bash
# Find IServiceProvider.GetService calls (excluding Startup/Program)
grep -rn "IServiceProvider.*GetService\|serviceProvider\.GetService" --include="*.cs" . | grep -v "Startup\|Program\.cs"

# Find GetRequiredService calls
grep -rn "GetRequiredService" --include="*.cs" . | grep -v "Startup\|Program\.cs"
```

**Code Example:**

```csharp
// ❌ Bad: Service Locator hides dependencies
public class OrderService
{
    private readonly IServiceProvider _serviceProvider;

    public OrderService(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public void ProcessOrder()
    {
        var emailService = _serviceProvider.GetService<IEmailService>();
        emailService.SendEmail(); // Hidden dependency
    }
}

// ✓ Good: Explicit dependency injection
public class OrderService
{
    private readonly IEmailService _emailService;

    public OrderService(IEmailService emailService)
    {
        _emailService = emailService;
    }

    public void ProcessOrder()
    {
        _emailService.SendEmail(); // Clear dependency
    }
}
```

**When to Flag:**
- **High:** IServiceProvider injected into business logic or controllers
- **Minor:** Acceptable in factories, middleware, or framework extension points

## Captive Dependencies

**High:** Singleton services capturing scoped/transient dependencies causes stale data and memory leaks.

**Detection:**

```bash
# Find singleton registrations
grep -rn "AddSingleton" --include="*.cs" .

# Check for DbContext in singleton (manual review needed)
grep -rn "AddSingleton.*DbContext\|AddSingleton.*Repository" --include="*.cs" .
```

**Code Example:**

```csharp
// ❌ Bad: Singleton captures DbContext (scoped)
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddDbContext<AppDbContext>();
        services.AddSingleton<OrderService>(); // OrderService uses DbContext
    }
}

public class OrderService
{
    private readonly AppDbContext _context; // CAPTIVE DEPENDENCY

    public OrderService(AppDbContext context)
    {
        _context = context; // DbContext lives forever in singleton
    }
}

// ✓ Good: Match lifetimes or use factory pattern
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddDbContext<AppDbContext>();
        services.AddScoped<OrderService>(); // Match DbContext lifetime
    }
}

// ✓ Good: Or use IServiceScopeFactory in singleton
public class OrderService
{
    private readonly IServiceScopeFactory _scopeFactory;

    public OrderService(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    public async Task ProcessOrder()
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        // Use context
    }
}
```

**When to Flag:**
- **High:** Singleton service injecting scoped dependencies (especially DbContext)
- **Critical:** Can cause data corruption or memory leaks

## Improper HttpClient Instantiation

**High:** Creating HttpClient instances directly causes socket exhaustion.

**Detection:**

```bash
# Find new HttpClient() (excluding IHttpClientFactory usage)
grep -rn "new HttpClient()" --include="*.cs" . | grep -v "IHttpClientFactory\|HttpClientFactory"

# Check for IHttpClientFactory registration
grep -rn "AddHttpClient" --include="*.cs" .
```

**Code Example:**

```csharp
// ❌ Bad: Creates new HttpClient per request (socket exhaustion)
public class ApiService
{
    public async Task<string> GetData()
    {
        using var client = new HttpClient(); // SOCKET EXHAUSTION
        return await client.GetStringAsync("https://api.example.com");
    }
}

// ❌ Bad: Static HttpClient but no proper configuration
public class ApiService
{
    private static readonly HttpClient _client = new HttpClient();
    // Missing timeout, DNS refresh, etc.
}

// ✓ Good: IHttpClientFactory with typed client
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddHttpClient<ApiService>(client =>
        {
            client.BaseAddress = new Uri("https://api.example.com");
            client.Timeout = TimeSpan.FromSeconds(30);
        });
    }
}

public class ApiService
{
    private readonly HttpClient _httpClient;

    public ApiService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<string> GetData()
    {
        return await _httpClient.GetStringAsync("/endpoint");
    }
}

// ✓ Good: Named client approach
public class ApiService
{
    private readonly IHttpClientFactory _clientFactory;

    public ApiService(IHttpClientFactory clientFactory)
    {
        _clientFactory = clientFactory;
    }

    public async Task<string> GetData()
    {
        var client = _clientFactory.CreateClient("ApiClient");
        return await client.GetStringAsync("/endpoint");
    }
}
```

**When to Flag:**
- **High:** Any `new HttpClient()` outside of test code
- **Critical:** In hot paths or high-traffic endpoints

## Configuration Anti-Patterns

**High:** Hardcoded configuration prevents environment-specific settings.

**Detection:**

```bash
# Find hardcoded connection strings
grep -rn "Server=.*Password=\|Data Source=.*Password=" --include="*.cs" .

# Find hardcoded URLs
grep -rn "https://.*\.com\|http://.*\.com" --include="*.cs" . | grep -v "///"

# Check for appsettings.json
[ -f "appsettings.json" ] && echo "Found appsettings.json"

# Find magic strings that should be config
grep -rn "\"smtp\.\|\"api\.\|\"db\." --include="*.cs" .
```

**Code Example:**

```csharp
// ❌ Bad: Hardcoded configuration
public class EmailService
{
    private const string SmtpServer = "smtp.gmail.com";
    private const int SmtpPort = 587;
    private const string ApiKey = "sk_live_12345"; // EXPOSED SECRET
}

// ❌ Bad: Connection string in code
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer("Server=prod-db;Password=admin123")); // EXPOSED
    }
}

// ✓ Good: Configuration from appsettings.json
public class EmailSettings
{
    public string SmtpServer { get; set; }
    public int SmtpPort { get; set; }
}

public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.Configure<EmailSettings>(Configuration.GetSection("Email"));

        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(Configuration.GetConnectionString("DefaultConnection")));
    }
}

public class EmailService
{
    private readonly EmailSettings _settings;

    public EmailService(IOptions<EmailSettings> settings)
    {
        _settings = settings.Value;
    }
}
```

**When to Flag:**
- **Critical:** Hardcoded passwords, API keys, or secrets
- **High:** Hardcoded URLs or connection strings
- **Important:** Any environment-specific values

## Missing Health Checks

**Important:** Health checks enable monitoring and load balancer integration.

**Detection:**

```bash
# Check for health check registration
grep -rn "AddHealthChecks\|MapHealthChecks" --include="*.cs" .

# Find DbContext without health checks
grep -rn "AddDbContext" --include="*.cs" . | wc -l
```

**Code Example:**

```csharp
// ❌ Bad: No health checks configured
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddDbContext<AppDbContext>();
        // No health checks
    }

    public void Configure(IApplicationBuilder app)
    {
        app.UseRouting();
        app.UseEndpoints(endpoints => endpoints.MapControllers());
    }
}

// ✓ Good: Health checks for dependencies
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddDbContext<AppDbContext>();

        services.AddHealthChecks()
            .AddDbContextCheck<AppDbContext>()
            .AddUrlGroup(new Uri("https://api.example.com"), "External API");
    }

    public void Configure(IApplicationBuilder app)
    {
        app.UseRouting();
        app.UseEndpoints(endpoints =>
        {
            endpoints.MapHealthChecks("/health");
            endpoints.MapControllers();
        });
    }
}
```

**When to Flag:**
- **Important:** ASP.NET Core apps without any health checks
- **High:** Apps with external dependencies (DB, APIs) without health checks

## API Versioning Issues

**Minor:** Missing versioning makes breaking changes difficult.

**Detection:**

```bash
# Check for API versioning
grep -rn "AddApiVersioning\|MapToApiVersion" --include="*.cs" .

# Count API controllers
find . -path "*/Controllers/*Controller.cs" | wc -l
```

**Code Example:**

```csharp
// ❌ Bad: No versioning strategy
[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    // Breaking changes affect all clients
}

// ✓ Good: URL-based versioning
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddApiVersioning(options =>
        {
            options.DefaultApiVersion = new ApiVersion(1, 0);
            options.AssumeDefaultVersionWhenUnspecified = true;
            options.ReportApiVersions = true;
        });
    }
}

[ApiController]
[Route("api/v{version:apiVersion}/products")]
[ApiVersion("1.0")]
public class ProductsV1Controller : ControllerBase
{
    // V1 implementation
}

[ApiController]
[Route("api/v{version:apiVersion}/products")]
[ApiVersion("2.0")]
public class ProductsV2Controller : ControllerBase
{
    // V2 with breaking changes
}
```

**When to Flag:**
- **Minor:** Public APIs without versioning
- **Important:** Before making breaking changes

## LINQ Inefficiencies

**Important:** Inefficient LINQ can cause performance issues.

**Detection:**

```bash
# Find multiple enumeration
grep -rn "\.ToList().*\.Where\|\.ToArray().*\.Where" --include="*.cs" .

# Find Count() when Any() would work
grep -rn "\.Count() > 0\|\.Count() != 0" --include="*.cs" .

# Find First() without error handling
grep -rn "\.First()" --include="*.cs" . | grep -v "FirstOrDefault"
```

**Code Example:**

```csharp
// ❌ Bad: Multiple enumeration
public void ProcessOrders(List<Order> orders)
{
    var validOrders = orders.Where(o => o.IsValid).ToList();
    var count = validOrders.Count(); // Already enumerated
    var first = validOrders.First(); // Already enumerated
}

// ❌ Bad: Count() > 0 instead of Any()
if (orders.Count() > 0) // Enumerates entire collection
{
    // Process
}

// ❌ Bad: First() throws if empty
var order = orders.First(); // Exception if empty

// ✓ Good: Single enumeration with efficient checks
public void ProcessOrders(List<Order> orders)
{
    var validOrders = orders.Where(o => o.IsValid).ToList();
    if (validOrders.Count > 0) // List.Count is O(1)
    {
        var first = validOrders[0]; // Direct access
    }
}

// ✓ Good: Any() for existence checks
if (orders.Any()) // Stops after first element
{
    // Process
}

// ✓ Good: FirstOrDefault with null check
var order = orders.FirstOrDefault();
if (order != null)
{
    // Process
}
```

**When to Flag:**
- **Important:** `.Count() > 0` or `.Count() != 0` (use `.Any()`)
- **Important:** Multiple enumerations of same query
- **Minor:** `.First()` without error handling (use `.FirstOrDefault()`)

## God Object Pattern

**High:** Classes with too many responsibilities violate Single Responsibility Principle.

**Detection:**

```bash
# Find large classes (>500 lines)
find . -name "*.cs" -exec sh -c 'lines=$(wc -l < "$1"); if [ $lines -gt 500 ]; then echo "$1: $lines lines"; fi' _ {} \;

# Find classes with many methods (>20)
grep -rn "public.*{" --include="*.cs" . | grep -v "class\|interface\|enum" | cut -d: -f1 | sort | uniq -c | sort -rn | head -20

# Find classes with many dependencies (>10 constructor parameters)
grep -A 30 "public.*ctor\|public.*(" --include="*.cs" . | grep -E "^\s*I[A-Z].*," | wc -l
```

**Code Example:**

```csharp
// ❌ Bad: God object with too many responsibilities
public class OrderService
{
    // 15 dependencies injected
    public OrderService(
        IOrderRepository orderRepo,
        ICustomerRepository customerRepo,
        IProductRepository productRepo,
        IEmailService emailService,
        IPaymentService paymentService,
        IShippingService shippingService,
        IInventoryService inventoryService,
        ITaxService taxService,
        IDiscountService discountService,
        INotificationService notificationService,
        IAuditService auditService,
        ILogger logger,
        IMapper mapper,
        IConfiguration config,
        IServiceProvider serviceProvider)
    { }

    // 50+ methods handling everything
    public void CreateOrder() { }
    public void UpdateOrder() { }
    public void CancelOrder() { }
    public void ProcessPayment() { }
    public void SendConfirmationEmail() { }
    public void CalculateTax() { }
    public void ApplyDiscounts() { }
    public void UpdateInventory() { }
    public void ShipOrder() { }
    public void GenerateInvoice() { }
    // ... 40 more methods
}

// ✓ Good: Split into focused services
public class OrderService
{
    private readonly IOrderRepository _orderRepo;
    private readonly IOrderProcessor _orderProcessor;

    public OrderService(IOrderRepository orderRepo, IOrderProcessor orderProcessor)
    {
        _orderRepo = orderRepo;
        _orderProcessor = orderProcessor;
    }

    public async Task<Order> CreateOrder(CreateOrderRequest request)
    {
        var order = new Order(request);
        await _orderRepo.AddAsync(order);
        await _orderProcessor.ProcessAsync(order);
        return order;
    }
}

public class OrderProcessor
{
    private readonly IPaymentService _paymentService;
    private readonly IInventoryService _inventoryService;
    private readonly INotificationService _notificationService;

    // Focused on order processing workflow
}
```

**When to Flag:**
- **High:** Classes >500 lines or >20 public methods
- **High:** Classes with >8 constructor dependencies
- **Important:** Classes with multiple unrelated responsibilities

## Static Cling

**Important:** Excessive static usage creates tight coupling and testing difficulties.

**Detection:**

```bash
# Count static members
grep -rn "static.*=" --include="*.cs" . | wc -l

# Find static classes (excluding extension methods)
grep -rn "static class" --include="*.cs" . | grep -v "Extensions"

# Find static mutable state
grep -rn "static.*=" --include="*.cs" . | grep -v "readonly"
```

**Code Example:**

```csharp
// ❌ Bad: Static mutable state
public class OrderService
{
    private static int _orderCount = 0; // Shared mutable state
    private static List<Order> _cache = new(); // Thread-unsafe

    public void ProcessOrder(Order order)
    {
        _orderCount++; // Race condition
        _cache.Add(order); // Not thread-safe
    }
}

// ❌ Bad: Static methods with external dependencies
public static class EmailHelper
{
    public static void SendEmail(string to, string subject)
    {
        var client = new SmtpClient("smtp.gmail.com"); // Hard to test
        client.Send(to, subject, "body");
    }
}

// ✓ Good: Instance methods with dependency injection
public class OrderService
{
    private readonly IMemoryCache _cache;
    private int _orderCount; // Instance state (or use ICounter)

    public OrderService(IMemoryCache cache)
    {
        _cache = cache;
    }

    public void ProcessOrder(Order order)
    {
        Interlocked.Increment(ref _orderCount);
        _cache.Set($"order-{order.Id}", order);
    }
}

// ✓ Good: Static utility methods (pure functions)
public static class StringHelper
{
    public static string Slugify(string input)
    {
        // Pure function, no dependencies
        return input.ToLowerInvariant().Replace(" ", "-");
    }
}
```

**When to Flag:**
- **High:** Static mutable state (non-readonly)
- **Important:** Static methods with external dependencies
- **Minor:** Excessive static classes (except pure utility methods)

## Disabled Tests

**Critical:** Disabled tests hide failures and rot over time.

**Detection:**

```bash
# Find disabled xUnit tests
grep -rn "\[Fact(Skip\|Theory(Skip" --include="*.cs" .

# Find NUnit Ignore attribute
grep -rn "\[Ignore\]" --include="*.cs" .

# Find MSTest Ignore
grep -rn "\[TestMethod.*Ignore\]" --include="*.cs" .

# Find commented-out tests
grep -rn "//.*\[Fact\]\|//.*\[Test\]" --include="*.cs" .

# Find #if false around tests
grep -B 5 -A 10 "#if false" --include="*.cs" . | grep -i "test"
```

**Code Example:**

```csharp
// ❌ Bad: Disabled test hiding failure
[Fact(Skip = "Flaky test, fix later")]
public void TestOrderProcessing()
{
    // This test fails intermittently, but disabling hides the issue
}

// ❌ Bad: Commented-out test
// [Fact]
// public void TestPayment()
// {
//     // Test was disabled during refactor
// }

// ❌ Bad: Conditional compilation hiding tests
#if false
[Fact]
public void TestShipping()
{
    // Hidden from compilation
}
#endif

// ✓ Good: Fix flaky tests properly
[Fact]
public async Task TestOrderProcessing()
{
    // Use proper test isolation
    await using var scope = _factory.Services.CreateAsyncScope();
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    // Seed test data
    context.Orders.Add(new Order { Id = 1 });
    await context.SaveChangesAsync();

    // Test with isolated data
}

// ✓ Good: If test needs refactoring, create issue and use WIP attribute
[Fact]
[Trait("Category", "WIP")]
public void TestPayment()
{
    // TODO: Issue #123 - Refactor after payment service redesign
    // Test still runs but marked as work-in-progress
}
```

**When to Flag:**
- **Critical:** Any `[Fact(Skip=...)]`, `[Ignore]`, or commented tests
- **Critical:** `#if false` around test methods
- **High:** Tests that fail intermittently (fix root cause, don't disable)

## Warning Suppression

**Important:** Warning suppression without justification hides code quality issues.

**Detection:**

```bash
# Find #pragma warning disable
grep -rn "#pragma warning disable" --include="*.cs" .

# Find SuppressMessage attributes
grep -rn "\[SuppressMessage" --include="*.cs" .

# Find SuppressWarnings in comments
grep -rn "\/\/ suppress\|\/\/ disable warning" --include="*.cs" -i
```

**Code Example:**

```csharp
// ❌ Bad: Blanket suppression without justification
#pragma warning disable CS8618 // Non-nullable property uninitialized
public class User
{
    public string Name { get; set; } // Null reference warning hidden
}
#pragma warning restore CS8618

// ❌ Bad: Suppressing important warnings
#pragma warning disable CS4014 // Async call not awaited
public void ProcessOrder()
{
    ProcessPaymentAsync(); // Fire-and-forget, exceptions lost
}
#pragma warning restore CS4014

// ✓ Good: Specific suppression with justification
// Suppress CA1062: EF Core guarantees entity is not null in this context
[SuppressMessage("Design", "CA1062:Validate arguments of public methods")]
public void UpdateOrder(Order order)
{
    _context.Orders.Update(order);
}

// ✓ Good: Fix the warning instead of suppressing
public class User
{
    public string Name { get; set; } = string.Empty; // Initialize properly
}

// ✓ Good: Await async calls
public async Task ProcessOrder()
{
    await ProcessPaymentAsync();
}
```

**When to Flag:**
- **Critical:** Suppression of async warnings (CS4014)
- **High:** Suppression of nullability warnings without justification
- **Important:** Any suppression without explanatory comment
- **Minor:** Acceptable for analyzer false positives (with comment)

## Empty Catch Blocks

**Critical:** Empty catch blocks swallow errors and hide failures.

**Detection:**

```bash
# Find empty catch blocks
grep -rn "catch.*{[ ]*}" --include="*.cs" .

# Find catch with only comment
grep -A 2 "catch" --include="*.cs" . | grep -B 1 "\/\/"

# Find catch without throw or logging
grep -A 5 "catch (Exception" --include="*.cs" . | grep -v "throw\|Log\|_logger"
```

**Code Example:**

```csharp
// ❌ Bad: Empty catch swallows all errors
public void ProcessOrder(Order order)
{
    try
    {
        _paymentService.ProcessPayment(order);
    }
    catch (Exception)
    {
        // Silent failure - order appears successful but payment failed
    }
}

// ❌ Bad: Catch with comment but no action
public void SaveOrder(Order order)
{
    try
    {
        _context.SaveChanges();
    }
    catch (DbUpdateException)
    {
        // TODO: Handle this later
    }
}

// ✓ Good: Log and rethrow or handle specifically
public async Task ProcessOrder(Order order)
{
    try
    {
        await _paymentService.ProcessPaymentAsync(order);
    }
    catch (PaymentException ex)
    {
        _logger.LogError(ex, "Payment failed for order {OrderId}", order.Id);
        throw; // Rethrow to let caller handle
    }
}

// ✓ Good: Handle specific exceptions with fallback
public async Task<Order> GetOrder(int id)
{
    try
    {
        return await _cache.GetAsync<Order>($"order-{id}");
    }
    catch (CacheException ex)
    {
        _logger.LogWarning(ex, "Cache miss for order {OrderId}, fetching from DB", id);
        return await _context.Orders.FindAsync(id);
    }
}
```

**When to Flag:**
- **Critical:** Empty catch blocks
- **Critical:** Catch without logging or rethrowing
- **High:** Catching `Exception` base class without specific reason

## Catching Exception Base Class

**High:** Catching `Exception` base class hides programming mistakes.

**Detection:**

```bash
# Find catch (Exception) without when clause or rethrow
grep -rn "catch\s*(Exception[^S]" --include="*.cs" . | grep -v "when\|throw"

# Find catch without specific exception type
grep -rn "catch\s*{" --include="*.cs" .
```

**Code Example:**

```csharp
// ❌ Bad: Catches programming errors like NullReferenceException
public void ProcessOrder(Order order)
{
    try
    {
        var price = order.Items.First().Price; // Can throw ArgumentNullException
        var tax = CalculateTax(price);
    }
    catch (Exception ex) // Catches null refs, index errors, etc.
    {
        _logger.LogError(ex, "Order processing failed");
        // Programming bug hidden as business error
    }
}

// ❌ Bad: Catch-all without discrimination
public async Task<bool> SaveOrder(Order order)
{
    try
    {
        await _context.SaveChangesAsync();
        return true;
    }
    catch // Catches EVERYTHING including OutOfMemoryException
    {
        return false; // Critical errors silently swallowed
    }
}

// ✓ Good: Catch specific expected exceptions
public async Task ProcessOrder(Order order)
{
    try
    {
        await _paymentService.ProcessPaymentAsync(order);
    }
    catch (PaymentDeclinedException ex)
    {
        _logger.LogWarning(ex, "Payment declined for order {OrderId}", order.Id);
        order.Status = OrderStatus.PaymentFailed;
    }
    catch (PaymentTimeoutException ex)
    {
        _logger.LogError(ex, "Payment timeout for order {OrderId}", order.Id);
        throw; // Retry at higher level
    }
    // Let programming errors (NullRef, etc.) bubble up unhandled
}

// ✓ Good: Catch Exception only at boundary with filter
[HttpPost]
public async Task<IActionResult> CreateOrder(CreateOrderRequest request)
{
    try
    {
        var order = await _orderService.CreateOrderAsync(request);
        return Ok(order);
    }
    catch (Exception ex) when (ex is not OutOfMemoryException && ex is not StackOverflowException)
    {
        _logger.LogError(ex, "Order creation failed");
        return StatusCode(500, "An error occurred");
    }
}
```

**When to Flag:**
- **High:** `catch (Exception)` without when clause in business logic
- **Critical:** `catch { }` without type specification
- **Important:** Catching `Exception` but not rethrowing or logging
- **Minor:** Acceptable at API boundaries with proper logging

## Test Delays

**Important:** Thread.Sleep and Task.Delay in tests mask race conditions.

**Detection:**

```bash
# Find Task.Delay in test files
grep -rn "Task\.Delay\|Thread\.Sleep" --include="*.cs" . | grep -i "test"

# Find delays in test methods
grep -A 20 "\[Fact\]\|\[Test\]" --include="*.cs" . | grep "Delay\|Sleep"
```

**Code Example:**

```csharp
// ❌ Bad: Delay masks race condition
[Fact]
public async Task TestEventualConsistency()
{
    await _orderService.CreateOrderAsync(order);
    await Task.Delay(1000); // Hope data is ready by now
    var saved = await _orderService.GetOrderAsync(order.Id);
    Assert.NotNull(saved);
}

// ❌ Bad: Sleep makes tests slow and flaky
[Test]
public void TestCacheExpiration()
{
    _cache.Set("key", "value", TimeSpan.FromSeconds(1));
    Thread.Sleep(1500); // Slow and flaky
    var result = _cache.Get("key");
    Assert.IsNull(result);
}

// ✓ Good: Use proper async patterns
[Fact]
public async Task TestEventualConsistency()
{
    await _orderService.CreateOrderAsync(order);
    // Async operation completes when awaited
    var saved = await _orderService.GetOrderAsync(order.Id);
    Assert.NotNull(saved);
}

// ✓ Good: Use polling with timeout for eventual consistency
[Fact]
public async Task TestEventProcessing()
{
    await _eventPublisher.PublishAsync(new OrderCreatedEvent(order.Id));

    var result = await WaitForConditionAsync(
        async () => await _orderService.GetOrderAsync(order.Id) != null,
        timeout: TimeSpan.FromSeconds(5));

    Assert.True(result);
}

private async Task<bool> WaitForConditionAsync(Func<Task<bool>> condition, TimeSpan timeout)
{
    var cts = new CancellationTokenSource(timeout);
    while (!cts.Token.IsCancellationRequested)
    {
        if (await condition()) return true;
        await Task.Delay(100, cts.Token);
    }
    return false;
}
```

**When to Flag:**
- **Important:** Any `Task.Delay()` or `Thread.Sleep()` in test methods
- **High:** Delays >500ms indicating serious timing dependencies
- **Minor:** Acceptable for testing timeout behavior (with justification)

## Project-Level Warning Suppression

**High:** Project-wide warning suppression degrades code quality over time.

**Detection:**

```bash
# Find NoWarn in .csproj
grep -rn "<NoWarn>" --include="*.csproj" .

# Find TreatWarningsAsErrors disabled
grep -rn "TreatWarningsAsErrors.*false" --include="*.csproj" .

# Find warning level reduced
grep -rn "WarningLevel.*[0-2]" --include="*.csproj" .
```

**Code Example:**

```xml
<!-- ❌ Bad: Blanket suppression in .csproj -->
<PropertyGroup>
  <NoWarn>CS8618;CS8602;CS8603;CS8604</NoWarn>
  <TreatWarningsAsErrors>false</TreatWarningsAsErrors>
  <WarningLevel>1</WarningLevel>
</PropertyGroup>

<!-- ❌ Bad: Disabling nullable warnings project-wide -->
<PropertyGroup>
  <Nullable>disable</Nullable>
</PropertyGroup>

<!-- ✓ Good: Enable nullable and fix warnings -->
<PropertyGroup>
  <Nullable>enable</Nullable>
  <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  <WarningLevel>5</WarningLevel>
</PropertyGroup>

<!-- ✓ Good: Suppress specific false positives only -->
<PropertyGroup>
  <!-- Suppress CA1062 for EF entities (false positive) -->
  <NoWarn>CA1062</NoWarn>
</PropertyGroup>
```

**When to Flag:**
- **High:** `<NoWarn>` with multiple warning codes
- **High:** `TreatWarningsAsErrors=false` in non-legacy projects
- **Important:** `<Nullable>disable</Nullable>` in new projects
- **Minor:** Acceptable for specific false positives with comments

## Async Void in Tests

**High:** Async void tests can complete before assertions run.

**Detection:**

```bash
# Find async void test methods
grep -A 2 "\[Fact\]\|\[Test\]\|\[TestMethod\]" --include="*.cs" . | grep "async void"

# Find test methods returning void but using await
grep -A 5 "\[Fact\]" --include="*.cs" . | grep -B 2 "await"
```

**Code Example:**

```csharp
// ❌ Bad: Async void test (completes immediately)
[Fact]
public async void TestOrderCreation() // WRONG
{
    var order = await _orderService.CreateOrderAsync(request);
    Assert.NotNull(order); // May not run
}

// ❌ Bad: Test method not awaited
[Fact]
public void TestOrderCreation()
{
    var order = _orderService.CreateOrderAsync(request); // Not awaited
    Assert.NotNull(order); // Tests Task<Order>, not Order
}

// ✓ Good: Async Task test method
[Fact]
public async Task TestOrderCreation()
{
    var order = await _orderService.CreateOrderAsync(request);
    Assert.NotNull(order);
}

// ✓ Good: Synchronous test for sync code
[Fact]
public void TestOrderValidation()
{
    var result = _validator.Validate(order);
    Assert.True(result.IsValid);
}
```

**When to Flag:**
- **High:** Any `async void` test method
- **High:** Test methods with unawaited Task returns

## Roslyn Analyzer Integration

**Check for built-in code analysis during build:**

```bash
# Check if dotnet CLI is available
command -v dotnet && echo "✓ .NET CLI available" || echo "✗ .NET CLI not found"

# Enable code style enforcement
dotnet build /p:EnforceCodeStyleInBuild=true

# Check for analyzer warnings in build output
dotnet build 2>&1 | grep -E "CA[0-9]{4}|IDE[0-9]{4}"

# List all warnings
dotnet build 2>&1 | grep "warning"

# Count warnings by type
dotnet build 2>&1 | grep -oE "CA[0-9]{4}|IDE[0-9]{4}" | sort | uniq -c | sort -rn
```

**Common Roslyn analyzers to check:**

- **CA1062**: Validate arguments of public methods
- **CA2007**: Do not directly await a Task (ConfigureAwait)
- **CA1031**: Do not catch general exception types
- **CA1826**: Use property instead of Linq enumerable method
- **CA1069**: Enums should not have duplicate values
- **IDE0005**: Remove unnecessary using directives
- **IDE0058**: Expression value is never used

**Recommend enabling in .csproj:**

```xml
<PropertyGroup>
  <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
  <EnableNETAnalyzers>true</EnableNETAnalyzers>
  <AnalysisLevel>latest</AnalysisLevel>
</PropertyGroup>
```

**When to Flag:**
- **Important:** Projects without code analysis enabled
- **High:** Build output with >10 analyzer warnings
- **Minor:** Recommend Security Code Scan for security-focused analysis
