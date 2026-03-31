# .NET & C# Issues

Reference for: PR Review

Load when diff contains `*.cs`, `*.csproj`, `*.sln`, `*.razor` files.

## Table of Contents

1. [Async Pitfalls](#async-pitfalls)
2. [Dependency Injection](#dependency-injection)
3. [Entity Framework](#entity-framework)
4. [Security](#security)
5. [Error Handling](#error-handling)
6. [Performance](#performance)
7. [Quick Reference](#quick-reference)

---

## Async Pitfalls

### Sync-over-Async (Deadlock Risk)
```csharp
// Bad — blocks thread, can deadlock in ASP.NET
var result = GetDataAsync().Result;
var result = GetDataAsync().GetAwaiter().GetResult();

// Good
var result = await GetDataAsync();
```

### Async Void (Fire-and-Forget)
```csharp
// Bad — exceptions are unobservable, crashes the process
async void HandleClick(object sender, EventArgs e)
{
    await DoWorkAsync();
}

// Good — only use async void for event handlers if unavoidable
async Task HandleClickAsync()
{
    await DoWorkAsync();
}
```

### Missing ConfigureAwait in Libraries
```csharp
// Bad in library code — captures synchronization context unnecessarily
var data = await httpClient.GetStringAsync(url);

// Good in library code
var data = await httpClient.GetStringAsync(url).ConfigureAwait(false);
```

### Missing CancellationToken
```csharp
// Bad — no way to cancel long-running operations
public async Task<List<Order>> GetOrdersAsync()
{
    return await _db.Orders.ToListAsync();
}

// Good
public async Task<List<Order>> GetOrdersAsync(CancellationToken ct = default)
{
    return await _db.Orders.ToListAsync(ct);
}
```

## Dependency Injection

### Wrong Service Lifetime
```csharp
// Bad — DbContext is scoped, injecting into singleton captures a disposed instance
services.AddSingleton<MyService>();  // MyService depends on DbContext

// Good — match or use shorter lifetime
services.AddScoped<MyService>();

// Good — if singleton is required, use IServiceScopeFactory
public class MyService
{
    private readonly IServiceScopeFactory _scopeFactory;

    public async Task DoWork()
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    }
}
```

### Service Locator Anti-Pattern
```csharp
// Bad — hides dependencies, hard to test
public class OrderService
{
    public void Process()
    {
        var logger = ServiceLocator.Get<ILogger>();
    }
}

// Good — explicit constructor injection
public class OrderService
{
    private readonly ILogger<OrderService> _logger;

    public OrderService(ILogger<OrderService> logger)
    {
        _logger = logger;
    }
}
```

## Entity Framework

### N+1 Queries (Missing Include)
```csharp
// Bad — lazy loading fires a query per order
var customers = await _db.Customers.ToListAsync();
foreach (var c in customers)
{
    Console.WriteLine(c.Orders.Count);  // N+1!
}

// Good — eager load
var customers = await _db.Customers
    .Include(c => c.Orders)
    .ToListAsync();
```

### Fetching Entire Table
```csharp
// Bad — loads everything into memory
var allOrders = await _db.Orders.ToListAsync();
var filtered = allOrders.Where(o => o.Status == "Active");

// Good — filter in database
var filtered = await _db.Orders
    .Where(o => o.Status == "Active")
    .ToListAsync();
```

### Missing AsNoTracking for Read-Only Queries
```csharp
// Bad — change tracker overhead for data you won't modify
var products = await _db.Products.ToListAsync();

// Good
var products = await _db.Products.AsNoTracking().ToListAsync();
```

### Raw SQL Without Parameters
```csharp
// Bad — SQL injection
var users = _db.Users
    .FromSqlRaw($"SELECT * FROM Users WHERE Name = '{name}'")
    .ToList();

// Good
var users = _db.Users
    .FromSqlInterpolated($"SELECT * FROM Users WHERE Name = {name}")
    .ToList();
```

## Security

### Missing Authorization Attribute
```csharp
// Bad — endpoint is publicly accessible
[HttpGet("admin/users")]
public IActionResult GetUsers() { ... }

// Good
[Authorize(Roles = "Admin")]
[HttpGet("admin/users")]
public IActionResult GetUsers() { ... }
```

### Returning Internal Exceptions to Client
```csharp
// Bad — leaks stack traces and internal details
catch (Exception ex)
{
    return StatusCode(500, ex.ToString());
}

// Good
catch (Exception ex)
{
    _logger.LogError(ex, "Failed to process request");
    return Problem("An error occurred processing your request.");
}
```

### Missing Input Validation
```csharp
// Bad — trusts client input
[HttpPost]
public IActionResult Create(OrderDto order)
{
    _db.Orders.Add(order.ToEntity());
}

// Good — validate with FluentValidation or DataAnnotations
[HttpPost]
public IActionResult Create([FromBody] OrderDto order)
{
    if (!ModelState.IsValid)
        return BadRequest(ModelState);

    _db.Orders.Add(order.ToEntity());
}
```

## Error Handling

### Catching Too Broadly
```csharp
// Bad — swallows everything including OutOfMemoryException
try { ... }
catch (Exception) { return null; }

// Good — catch specific exceptions
try { ... }
catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
{
    return null;
}
catch (TimeoutException ex)
{
    _logger.LogWarning(ex, "Request timed out, retrying");
    return await RetryAsync();
}
```

### Missing Using/Dispose
```csharp
// Bad — resource leak
var stream = new FileStream(path, FileMode.Open);
var content = ReadAll(stream);
// stream never disposed

// Good
using var stream = new FileStream(path, FileMode.Open);
var content = ReadAll(stream);
```

## Performance

### String Concatenation in Loops
```csharp
// Bad — O(n^2) allocations
var result = "";
foreach (var item in items)
    result += item.ToString();

// Good
var sb = new StringBuilder();
foreach (var item in items)
    sb.Append(item);
```

### Allocating in Hot Paths
```csharp
// Bad — allocates a new list every call
public List<string> GetTags() => tags.Select(t => t.Name).ToList();

// Good — return IEnumerable or cache
public IReadOnlyList<string> GetTags() => _cachedTags;
```

---

## Quick Reference

| Issue | Search Pattern | Severity |
|-------|---------------|----------|
| Sync-over-async | `grep -r "\.Result\b\|\.GetAwaiter().GetResult()"` | Critical |
| Async void | `grep -r "async void"` | Critical |
| Missing auth | `grep -r "\[Http\(Get\|Post\|Put\|Delete\)\]" \| grep -v Authorize` | Important |
| Raw SQL | `grep -r "FromSqlRaw"` | Important |
| Missing dispose | `grep -r "new FileStream\|new StreamReader" \| grep -v using` | Important |
| Broad catch | `grep -r "catch (Exception)"` | Minor |
