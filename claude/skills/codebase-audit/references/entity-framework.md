# Entity Framework Core Patterns

Performance, security, and correctness issues specific to Entity Framework Core 6+.

## Table of Contents

- [Version Detection](#version-detection)
- [N+1 Query Problem](#n1-query-problem)
- [SQL Injection in Raw SQL](#sql-injection-in-raw-sql)
- [Loading Entire Tables](#loading-entire-tables)
- [DbContext Lifecycle Issues](#dbcontext-lifecycle-issues)
- [Tracking vs No-Tracking](#tracking-vs-no-tracking)
- [Cartesian Explosion](#cartesian-explosion)
- [Missing Projections](#missing-projections)
- [Connection String Security](#connection-string-security)
- [Lazy Loading Issues](#lazy-loading-issues)
- [Migration Anti-Patterns](#migration-anti-patterns)
- [Async All The Way](#async-all-the-way)

## Version Detection

**Check Entity Framework version:**

```bash
# Find EF Core package references
grep -r "Microsoft.EntityFrameworkCore" --include="*.csproj" .

# Find DbContext classes
grep -rn "class.*:.*DbContext" --include="*.cs" .

# Check for migrations
[ -d "Migrations" ] && echo "✓ EF Migrations found" || echo "✗ No migrations directory"

# Find DbContext registration
grep -rn "AddDbContext\|AddDbContextPool" --include="*.cs" .

# Count entities
find . -name "*DbContext.cs" -exec grep -h "DbSet<" {} \; | wc -l
```

**Version history:**
- EF Core 6.0 → Aligns with .NET 6 LTS
- EF Core 7.0 → JSON columns, bulk updates
- EF Core 8.0 → Complex types, primitive collections
- EF Core 9.0 → Latest features

## N+1 Query Problem

**Critical:** Loading related data in a loop causes hundreds or thousands of database queries.

### Detection Patterns

```bash
# Find foreach with async query inside
grep -rn "foreach.*await.*\." --include="*.cs" . | grep -i "context\|repository"

# Find loops with Include
grep -A 5 "foreach\|for\|while" --include="*.cs" . | grep "Include\|Where"

# Find Select with navigation property access
grep -rn "Select.*=>.*\." --include="*.cs" . | grep -v "Include"
```

### Vulnerable Code

```csharp
// ❌ Critical: Classic N+1 problem
public async Task<List<OrderDto>> GetOrders()
{
    var orders = await _context.Orders.ToListAsync(); // 1 query

    foreach (var order in orders) // N queries
    {
        order.Customer = await _context.Customers
            .FirstOrDefaultAsync(c => c.Id == order.CustomerId);
    }

    return orders;
}
// Result: 1 + N queries (if 100 orders = 101 queries!)

// ❌ Critical: N+1 in LINQ
public async Task<List<OrderDto>> GetOrderTotals()
{
    return await _context.Orders
        .Select(o => new OrderDto
        {
            OrderId = o.Id,
            // Triggers separate query per order
            CustomerName = _context.Customers
                .Where(c => c.Id == o.CustomerId)
                .Select(c => c.Name)
                .FirstOrDefault()
        })
        .ToListAsync();
}

// ❌ Critical: Lazy loading N+1
public async Task<List<OrderDto>> GetOrders()
{
    var orders = await _context.Orders.ToListAsync(); // 1 query

    return orders.Select(o => new OrderDto
    {
        OrderId = o.Id,
        CustomerName = o.Customer.Name // N queries (lazy loading)
    }).ToList();
}

// ✓ Good: Eager loading with Include
public async Task<List<OrderDto>> GetOrders()
{
    return await _context.Orders
        .Include(o => o.Customer) // Single JOIN query
        .Select(o => new OrderDto
        {
            OrderId = o.Id,
            CustomerName = o.Customer.Name
        })
        .ToListAsync();
}
// Result: 1 query with JOIN

// ✓ Good: Projection with navigation property
public async Task<List<OrderDto>> GetOrders()
{
    return await _context.Orders
        .Select(o => new OrderDto
        {
            OrderId = o.Id,
            CustomerName = o.Customer.Name, // EF translates to JOIN
            Items = o.Items.Select(i => i.ProductName).ToList()
        })
        .ToListAsync();
}
// Result: 1 query with JOINs

// ✓ Good: Split query for collections
public async Task<List<OrderDto>> GetOrders()
{
    return await _context.Orders
        .Include(o => o.Customer)
        .Include(o => o.Items)
        .AsSplitQuery() // Prevents cartesian explosion
        .Select(o => new OrderDto
        {
            OrderId = o.Id,
            CustomerName = o.Customer.Name,
            Items = o.Items.Select(i => i.ProductName).ToList()
        })
        .ToListAsync();
}
// Result: 2-3 queries (better than N+1)
```

**When to Flag:**
- **Critical:** Any foreach loop with database query inside
- **Critical:** Multiple queries in Select projection
- **Critical:** Lazy loading enabled without explicit includes
- **High:** Navigation property access without Include or projection

**Performance Impact:**
- 100 orders with N+1 = 101 queries (~500ms)
- 100 orders with Include = 1 query (~5ms)

## SQL Injection in Raw SQL

**Critical:** String interpolation in raw SQL queries.

### Detection Patterns

```bash
# Find FromSqlRaw with interpolation
grep -rn "FromSqlRaw.*\$\|FromSqlInterpolated.*\+" --include="*.cs" .

# Find ExecuteSqlRaw with interpolation
grep -rn "ExecuteSqlRaw.*\$\|ExecuteSqlRaw.*\+" --include="*.cs" .

# Find SqlQuery with string building
grep -rn "SqlQuery.*\+\|FromSql.*\+" --include="*.cs" .
```

### Vulnerable Code

```csharp
// ❌ Critical: String concatenation in FromSqlRaw
public async Task<List<Product>> SearchProducts(string category)
{
    return await _context.Products
        .FromSqlRaw("SELECT * FROM Products WHERE Category = '" + category + "'")
        .ToListAsync();
    // Attack: category = "' OR '1'='1"
}

// ❌ Critical: String interpolation in FromSqlRaw
public async Task<User> GetUser(string email)
{
    return await _context.Users
        .FromSqlRaw($"SELECT * FROM Users WHERE Email = '{email}'")
        .FirstOrDefaultAsync();
    // Attack: email = "' OR 1=1--"
}

// ❌ Critical: ExecuteSqlRaw with string building
public async Task DeleteOldOrders(DateTime cutoffDate)
{
    var sql = "DELETE FROM Orders WHERE CreatedAt < '" + cutoffDate.ToString() + "'";
    await _context.Database.ExecuteSqlRawAsync(sql);
}

// ✓ Good: FromSqlRaw with parameters (indexed)
public async Task<List<Product>> SearchProducts(string category)
{
    return await _context.Products
        .FromSqlRaw("SELECT * FROM Products WHERE Category = {0}", category)
        .ToListAsync();
}

// ✓ Good: FromSqlInterpolated (auto-parameterized)
public async Task<User> GetUser(string email)
{
    return await _context.Users
        .FromSqlInterpolated($"SELECT * FROM Users WHERE Email = {email}")
        .FirstOrDefaultAsync();
    // EF Core converts to parameters automatically
}

// ✓ Good: ExecuteSqlRaw with SqlParameter
public async Task DeleteOldOrders(DateTime cutoffDate)
{
    await _context.Database.ExecuteSqlRawAsync(
        "DELETE FROM Orders WHERE CreatedAt < @cutoffDate",
        new SqlParameter("@cutoffDate", cutoffDate));
}

// ✓ Good: LINQ instead of raw SQL
public async Task<List<Product>> SearchProducts(string category)
{
    return await _context.Products
        .Where(p => p.Category == category)
        .ToListAsync();
    // Always parameterized
}
```

**When to Flag:**
- **Critical:** `FromSqlRaw` with string concatenation or `$` interpolation
- **Critical:** `ExecuteSqlRaw` with string building
- **High:** Any raw SQL without parameterization
- **Important:** Recommend LINQ over raw SQL when possible

## Loading Entire Tables

**Critical:** Full table scans load millions of rows into memory.

### Detection Patterns

```bash
# Find ToList without Where
grep -rn "context\..*\.ToList()" --include="*.cs" . | grep -v "Where"

# Find ToArray without filtering
grep -rn "context\..*\.ToArray()" --include="*.cs" . | grep -v "Where"

# Find FirstOrDefault without Where (full scan)
grep -rn "\.FirstOrDefault()" --include="*.cs" . | grep -v "Where\|=>"

# Find Count without Where
grep -rn "context\..*\.Count()" --include="*.cs" . | grep -v "Where"
```

### Vulnerable Code

```csharp
// ❌ Critical: Loading entire table
public async Task<List<Order>> GetUserOrders(int userId)
{
    var allOrders = await _context.Orders.ToListAsync(); // Loads millions of rows
    return allOrders.Where(o => o.UserId == userId).ToList(); // Filters in memory
}

// ❌ Critical: FirstOrDefault without predicate
public async Task<Order> GetLatestOrder()
{
    return await _context.Orders
        .OrderByDescending(o => o.CreatedAt)
        .FirstOrDefaultAsync(); // Can scan entire table
}

// ❌ Critical: Count without filtering
public async Task<bool> HasOrders()
{
    var count = await _context.Orders.Count(); // Counts all rows
    return count > 0;
}

// ❌ High: Select all columns when only need few
public async Task<List<string>> GetProductNames()
{
    var products = await _context.Products.ToListAsync(); // Loads all columns
    return products.Select(p => p.Name).ToList();
}

// ✓ Good: Filter in database
public async Task<List<Order>> GetUserOrders(int userId)
{
    return await _context.Orders
        .Where(o => o.UserId == userId) // Filters in SQL
        .ToListAsync();
}

// ✓ Good: FirstOrDefault with predicate
public async Task<Order> GetLatestOrder(int userId)
{
    return await _context.Orders
        .Where(o => o.UserId == userId)
        .OrderByDescending(o => o.CreatedAt)
        .FirstOrDefaultAsync();
}

// ✓ Good: Any instead of Count
public async Task<bool> HasOrders(int userId)
{
    return await _context.Orders
        .Where(o => o.UserId == userId)
        .AnyAsync(); // Stops after first match
}

// ✓ Good: Projection for specific columns
public async Task<List<string>> GetProductNames()
{
    return await _context.Products
        .Select(p => p.Name) // Only fetches Name column
        .ToListAsync();
}
```

**When to Flag:**
- **Critical:** `ToList()`, `ToArray()`, or `Count()` without `Where`
- **Critical:** `FirstOrDefault()` without predicate or filtering
- **High:** Loading entities when only need specific columns
- **Important:** Missing pagination on large datasets

**Performance Impact:**
- Loading 1M orders = ~2GB memory, 30+ seconds
- Filtering in SQL = <100ms

## DbContext Lifecycle Issues

**Critical:** Incorrect DbContext lifetime causes memory leaks or stale data.

### Detection Patterns

```bash
# Find singleton DbContext registration
grep -rn "AddSingleton.*DbContext" --include="*.cs" .

# Find static DbContext
grep -rn "static.*DbContext" --include="*.cs" .

# Find DbContext in constructor of singleton
grep -A 10 "AddSingleton<" --include="*.cs" . | grep -B 5 "DbContext"

# Check for DbContext disposal
grep -rn "new.*DbContext\|DbContext()" --include="*.cs" . | grep -v "using"
```

### Vulnerable Code

```csharp
// ❌ Critical: Singleton service with DbContext (captive dependency)
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddDbContext<AppDbContext>(); // Scoped
        services.AddSingleton<OrderService>(); // OrderService uses DbContext
    }
}

public class OrderService
{
    private readonly AppDbContext _context; // Lives forever in singleton

    public OrderService(AppDbContext context)
    {
        _context = context; // MEMORY LEAK
    }
}

// ❌ Critical: Static DbContext
public static class DataAccess
{
    private static AppDbContext _context = new AppDbContext(); // Never disposed

    public static void AddOrder(Order order)
    {
        _context.Orders.Add(order);
        _context.SaveChanges();
    }
}

// ❌ High: Not disposing DbContext
public List<Order> GetOrders()
{
    var context = new AppDbContext(); // No using statement
    return context.Orders.ToList();
} // Context never disposed

// ❌ High: Reusing DbContext across requests
public class OrderRepository
{
    private AppDbContext _context; // Field, not injected

    public OrderRepository()
    {
        _context = new AppDbContext(); // Shared instance
    }

    public async Task<Order> GetOrder(int id)
    {
        return await _context.Orders.FindAsync(id); // Stale cached data
    }
}

// ✓ Good: Scoped DbContext (default)
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddDbContext<AppDbContext>(); // Scoped by default
        services.AddScoped<OrderService>(); // Match lifetime
    }
}

public class OrderService
{
    private readonly AppDbContext _context;

    public OrderService(AppDbContext context)
    {
        _context = context; // New instance per request
    }
}

// ✓ Good: Singleton with IServiceScopeFactory
public class BackgroundOrderProcessor : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;

    public BackgroundOrderProcessor(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            // Process orders
            await Task.Delay(1000);
        }
    }
}

// ✓ Good: Using statement for manual instantiation
public List<Order> GetOrders()
{
    using var context = new AppDbContext();
    return context.Orders.ToList();
} // Context disposed automatically

// ✓ Good: DbContext pooling for performance
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddDbContextPool<AppDbContext>(options =>
            options.UseSqlServer(connectionString));
    }
}
```

**When to Flag:**
- **Critical:** Singleton service with DbContext dependency
- **Critical:** Static DbContext instances
- **High:** DbContext not disposed (missing `using`)
- **High:** DbContext reused across multiple requests
- **Important:** Recommend `AddDbContextPool` for high-traffic APIs

**Lifetimes:**
- **Scoped** (default): One instance per HTTP request ✓
- **Transient**: New instance per injection ⚠️ (unnecessary)
- **Singleton**: One instance forever ❌ (memory leak)

## Tracking vs No-Tracking

**Important:** Tracking overhead for read-only queries.

### Detection Patterns

```bash
# Find queries without AsNoTracking
grep -rn "\.ToList\|\.FirstOrDefault\|\.Single" --include="*.cs" . | grep -v "AsNoTracking"

# Count read-only vs update operations
grep -rn "\.Update\|\.Remove\|SaveChanges" --include="*.cs" . | wc -l

# Find read-only endpoints
grep -rn "\[HttpGet\]" --include="*Controller.cs" . | wc -l
```

### Vulnerable Code

```csharp
// ❌ Important: Tracking on read-only query
[HttpGet]
public async Task<IActionResult> GetProducts()
{
    var products = await _context.Products.ToListAsync(); // Tracking enabled
    return Ok(products); // Never modified, wasted memory
}

// ❌ Important: Tracking when projecting to DTO
public async Task<List<ProductDto>> GetProducts()
{
    return await _context.Products
        .Select(p => new ProductDto
        {
            Id = p.Id,
            Name = p.Name
        })
        .ToListAsync(); // Tracking enabled but unnecessary
}

// ✓ Good: AsNoTracking for read-only queries
[HttpGet]
public async Task<IActionResult> GetProducts()
{
    var products = await _context.Products
        .AsNoTracking() // 40% faster, less memory
        .ToListAsync();
    return Ok(products);
}

// ✓ Good: AsNoTracking with projections
public async Task<List<ProductDto>> GetProducts()
{
    return await _context.Products
        .AsNoTracking()
        .Select(p => new ProductDto
        {
            Id = p.Id,
            Name = p.Name
        })
        .ToListAsync();
}

// ✓ Good: Tracking when updating
[HttpPut("{id}")]
public async Task<IActionResult> UpdateProduct(int id, UpdateProductRequest request)
{
    var product = await _context.Products
        .FirstOrDefaultAsync(p => p.Id == id); // Tracking needed for Update

    if (product == null) return NotFound();

    product.Name = request.Name;
    product.Price = request.Price;

    await _context.SaveChangesAsync(); // Tracks changes
    return Ok(product);
}

// ✓ Good: Global no-tracking for read-heavy apps
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
        ChangeTracker.QueryTrackingBehavior = QueryTrackingBehavior.NoTracking;
    }

    // Enable tracking explicitly when needed
    public async Task<Order> GetOrderForUpdate(int id)
    {
        return await Orders.AsTracking().FirstOrDefaultAsync(o => o.Id == id);
    }
}
```

**When to Flag:**
- **Important:** GET endpoints without `AsNoTracking`
- **Important:** Projections to DTOs without `AsNoTracking`
- **Minor:** Missing global no-tracking config in read-heavy apps

**Performance Impact:**
- Tracking overhead: ~30-40% slower, ~2x memory
- Use `AsNoTracking` for: Reports, APIs, read-only queries
- Use tracking for: Updates, deletes, change detection

## Cartesian Explosion

**High:** Multiple Includes cause exponential result rows.

### Detection Patterns

```bash
# Find multiple Include statements
grep -A 5 "Include(" --include="*.cs" . | grep "Include("

# Find ThenInclude chains
grep -rn "ThenInclude" --include="*.cs" .

# Find Include with collections
grep -rn "Include.*Items\|Include.*Orders\|Include.*Products" --include="*.cs" .
```

### Vulnerable Code

```csharp
// ❌ High: Cartesian explosion with multiple collections
public async Task<Order> GetOrder(int id)
{
    return await _context.Orders
        .Include(o => o.Items)        // 10 items
        .Include(o => o.Payments)     // 3 payments
        .Include(o => o.Shipments)    // 2 shipments
        .FirstOrDefaultAsync(o => o.Id == id);
    // Result: 10 * 3 * 2 = 60 rows returned for 1 order!
}

// ❌ High: Deep ThenInclude with collections
public async Task<List<Category>> GetCategories()
{
    return await _context.Categories
        .Include(c => c.Products)           // 100 products per category
            .ThenInclude(p => p.Reviews)    // 50 reviews per product
            .ThenInclude(r => r.User)
        .ToListAsync();
    // Result: Categories * Products * Reviews = massive dataset
}

// ✓ Good: Split query to avoid cartesian explosion
public async Task<Order> GetOrder(int id)
{
    return await _context.Orders
        .Include(o => o.Items)
        .Include(o => o.Payments)
        .Include(o => o.Shipments)
        .AsSplitQuery() // Generates 4 separate queries
        .FirstOrDefaultAsync(o => o.Id == id);
    // Result: 4 queries instead of 1 with 60 duplicate rows
}

// ✓ Good: Projection instead of Include
public async Task<OrderDto> GetOrder(int id)
{
    return await _context.Orders
        .Where(o => o.Id == id)
        .Select(o => new OrderDto
        {
            Id = o.Id,
            Items = o.Items.Select(i => new ItemDto
            {
                ProductName = i.ProductName,
                Quantity = i.Quantity
            }).ToList(),
            TotalAmount = o.Payments.Sum(p => p.Amount),
            ShipmentStatus = o.Shipments.OrderByDescending(s => s.Date)
                .Select(s => s.Status)
                .FirstOrDefault()
        })
        .FirstOrDefaultAsync();
}

// ✓ Good: Separate queries for collections
public async Task<OrderDetailDto> GetOrderWithDetails(int id)
{
    var order = await _context.Orders
        .AsNoTracking()
        .FirstOrDefaultAsync(o => o.Id == id);

    if (order == null) return null;

    var items = await _context.OrderItems
        .Where(i => i.OrderId == id)
        .ToListAsync();

    var payments = await _context.Payments
        .Where(p => p.OrderId == id)
        .ToListAsync();

    return new OrderDetailDto { Order = order, Items = items, Payments = payments };
}
```

**When to Flag:**
- **High:** Multiple `Include()` statements with collections
- **High:** Deep `ThenInclude` chains (>2 levels)
- **Important:** Missing `AsSplitQuery()` with multiple Includes
- **Minor:** Recommend projection over Include for complex scenarios

**Performance Impact:**
- Single query with 3 collections: 1000+ duplicate rows
- Split query: 3-4 separate queries, no duplication

## Missing Projections

**Important:** Loading full entities when only need specific columns.

### Detection Patterns

```bash
# Find ToList without Select
grep -rn "\.ToList()" --include="*.cs" . | grep -v "Select"

# Find Include with full entity return
grep -A 3 "Include(" --include="*.cs" . | grep -v "Select\|=>"

# Find APIs returning entities directly
grep -rn "Task<.*Entity>\|IActionResult.*Entity" --include="*Controller.cs" .
```

### Vulnerable Code

```csharp
// ❌ Important: Loading full entity with large blob
public async Task<List<Product>> GetProducts()
{
    return await _context.Products
        .Include(p => p.Category)
        .ToListAsync(); // Loads Description (1MB), Image (5MB), etc.
}

// ❌ Important: Over-fetching columns
[HttpGet]
public async Task<IActionResult> GetUsers()
{
    var users = await _context.Users.ToListAsync(); // Includes PasswordHash, etc.
    return Ok(users); // Exposes sensitive data
}

// ❌ High: Include when only need count
public async Task<int> GetOrderItemCount(int orderId)
{
    var order = await _context.Orders
        .Include(o => o.Items) // Loads all items
        .FirstOrDefaultAsync(o => o.Id == orderId);

    return order?.Items.Count ?? 0;
}

// ✓ Good: Project to DTO
public async Task<List<ProductDto>> GetProducts()
{
    return await _context.Products
        .Select(p => new ProductDto
        {
            Id = p.Id,
            Name = p.Name,
            Price = p.Price,
            CategoryName = p.Category.Name // Only columns needed
        })
        .ToListAsync();
}

// ✓ Good: Anonymous projection for internal use
public async Task<decimal> GetTotalRevenue()
{
    return await _context.Orders
        .Select(o => o.TotalAmount)
        .SumAsync();
}

// ✓ Good: Count without loading entities
public async Task<int> GetOrderItemCount(int orderId)
{
    return await _context.OrderItems
        .CountAsync(i => i.OrderId == orderId);
}

// ✓ Good: Configure entity to exclude sensitive columns by default
public class AppDbContext : DbContext
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .Ignore(u => u.PasswordHash); // Exclude from queries by default
    }
}
```

**When to Flag:**
- **Important:** Loading entities with BLOB columns (images, files)
- **Important:** Returning entities from APIs (use DTOs)
- **High:** Include for counts/sums (use Count/Sum directly)
- **Minor:** Missing projections for large entities (>20 columns)

## Connection String Security

**Critical:** Exposed credentials in connection strings.

### Detection Patterns

```bash
# Find connection strings in code
grep -rn "Server=.*Password=\|Data Source=.*Password=" --include="*.cs" .

# Check appsettings.json
grep -rn "ConnectionStrings" --include="appsettings*.json" .

# Find hardcoded credentials
grep -rn "User ID=\|Uid=\|Password=" --include="*.cs" .
```

### Vulnerable Code

```csharp
// ❌ Critical: Hardcoded connection string
public class AppDbContext : DbContext
{
    protected override void OnConfiguring(DbContextOptionsBuilder options)
    {
        options.UseSqlServer("Server=prod-db;Database=App;User=sa;Password=Admin123!");
    }
}

// ❌ Critical: Connection string in appsettings.json (in git)
// appsettings.json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=prod-db;Password=P@ssw0rd"
  }
}

// ✓ Good: Environment-specific configuration
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        var connectionString = Configuration.GetConnectionString("DefaultConnection");
        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(connectionString));
    }
}

// appsettings.Development.json (in .gitignore)
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=AppDev;Integrated Security=true"
  }
}

// ✓ Good: User Secrets in development
// dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=..."

// ✓ Good: Environment variables in production
// export ConnectionStrings__DefaultConnection="Server=..."

// ✓ Good: Azure Key Vault
public class Program
{
    public static IHostBuilder CreateHostBuilder(string[] args) =>
        Host.CreateDefaultBuilder(args)
            .ConfigureAppConfiguration((context, config) =>
            {
                if (context.HostingEnvironment.IsProduction())
                {
                    var builtConfig = config.Build();
                    var keyVaultEndpoint = builtConfig["KeyVault:Endpoint"];

                    config.AddAzureKeyVault(
                        new Uri(keyVaultEndpoint),
                        new DefaultAzureCredential());
                }
            });
}
```

**When to Flag:**
- **Critical:** Connection strings in code or committed config files
- **Critical:** Passwords in plain text
- **High:** No User Secrets in development
- **Important:** No Azure Key Vault or secret manager in production

## Lazy Loading Issues

**Important:** Lazy loading causes N+1 queries and is disabled by default in EF Core.

### Detection Patterns

```bash
# Check if lazy loading is enabled
grep -rn "UseLazyLoadingProxies\|UseLazyLoading" --include="*.cs" .

# Find virtual navigation properties (lazy loading)
grep -rn "public virtual.*{.*get.*set.*}" --include="*.cs" .

# Find proxies package
grep -r "Microsoft.EntityFrameworkCore.Proxies" --include="*.csproj" .
```

### Vulnerable Code

```csharp
// ❌ Important: Lazy loading enabled
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(connectionString)
                   .UseLazyLoadingProxies()); // Enables lazy loading
    }
}

public class Order
{
    public int Id { get; set; }
    public virtual Customer Customer { get; set; } // Lazy loaded
    public virtual ICollection<OrderItem> Items { get; set; } // Lazy loaded
}

// Causes N+1 queries
public async Task<List<OrderDto>> GetOrders()
{
    var orders = await _context.Orders.ToListAsync(); // 1 query

    return orders.Select(o => new OrderDto
    {
        CustomerName = o.Customer.Name, // N queries
        ItemCount = o.Items.Count       // N more queries
    }).ToList();
}

// ✓ Good: Explicit eager loading (default in EF Core)
public class Order
{
    public int Id { get; set; }
    public Customer Customer { get; set; } // Not virtual
    public ICollection<OrderItem> Items { get; set; }
}

public async Task<List<OrderDto>> GetOrders()
{
    return await _context.Orders
        .Include(o => o.Customer)
        .Include(o => o.Items)
        .Select(o => new OrderDto
        {
            CustomerName = o.Customer.Name,
            ItemCount = o.Items.Count
        })
        .ToListAsync(); // Single query with JOINs
}

// ✓ Good: Explicit loading when needed
public async Task<Order> GetOrderWithCustomer(int id)
{
    var order = await _context.Orders.FindAsync(id);

    await _context.Entry(order)
        .Reference(o => o.Customer)
        .LoadAsync(); // Explicit load

    return order;
}
```

**When to Flag:**
- **Important:** `UseLazyLoadingProxies()` enabled
- **Important:** Virtual navigation properties (enables lazy loading)
- **Minor:** Recommend explicit loading over lazy loading

**Note:** EF Core disables lazy loading by default. Only flag if explicitly enabled.

## Migration Anti-Patterns

**Important:** Poor migration practices cause deployment issues.

### Detection Patterns

```bash
# Find migrations directory
[ -d "Migrations" ] && ls -la Migrations/ | tail -5

# Check for pending migrations
dotnet ef migrations list 2>/dev/null | grep -i "pending"

# Find EnsureCreated (anti-pattern)
grep -rn "EnsureCreated\|EnsureDeleted" --include="*.cs" .

# Check for migration conflicts
find Migrations -name "*.cs" | xargs grep "CreateTable.*Orders" | wc -l
```

### Vulnerable Code

```csharp
// ❌ High: EnsureCreated in production
public class Program
{
    public static void Main(string[] args)
    {
        using var context = new AppDbContext();
        context.Database.EnsureCreated(); // Creates schema, no migrations
        // Cannot use migrations after this!
    }
}

// ❌ High: Auto-migration in production
public class Startup
{
    public void Configure(IApplicationBuilder app, AppDbContext context)
    {
        context.Database.Migrate(); // Runs migrations on app start
        // Dangerous in scaled deployments
    }
}

// ❌ Important: Manual SQL in migrations
public partial class AddUserTable : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("CREATE TABLE Users (Id INT, Name VARCHAR(100))");
        // No rollback, hard to maintain
    }
}

// ✓ Good: Migrations in development
// dotnet ef migrations add AddUserTable
// dotnet ef database update

// ✓ Good: Deploy-time migration script
public class Program
{
    public static void Main(string[] args)
    {
        var host = CreateHostBuilder(args).Build();

        // Run migrations in separate deployment step
        if (args.Contains("--migrate"))
        {
            using var scope = host.Services.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            context.Database.Migrate();
            return;
        }

        host.Run();
    }
}

// ✓ Good: SQL script for production
// dotnet ef migrations script --idempotent --output migration.sql
// Review and run SQL script in production

// ✓ Good: Proper migration
public partial class AddUserTable : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Users",
            columns: table => new
            {
                Id = table.Column<int>(nullable: false)
                    .Annotation("SqlServer:Identity", "1, 1"),
                Name = table.Column<string>(maxLength: 100, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Users", x => x.Id);
            });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "Users");
    }
}
```

**When to Flag:**
- **High:** `EnsureCreated()` or `EnsureDeleted()` in production code
- **High:** Auto-migration on app startup in production
- **Important:** Manual SQL in migrations without down migration
- **Minor:** Recommend idempotent migration scripts for production

## Async All The Way

**Important:** Mixing sync and async EF methods.

### Detection Patterns

```bash
# Find synchronous EF methods
grep -rn "\.ToList()\|\.FirstOrDefault()\|\.Count()\|\.Any()" --include="*.cs" . | grep "context\."

# Find SaveChanges (sync)
grep -rn "SaveChanges()" --include="*.cs" . | grep -v "SaveChangesAsync"

# Find Find (sync)
grep -rn "\.Find(" --include="*.cs" .
```

### Vulnerable Code

```csharp
// ❌ Important: Sync methods in async context
public async Task<Order> CreateOrder(CreateOrderRequest request)
{
    var order = new Order { ... };
    _context.Orders.Add(order);
    _context.SaveChanges(); // BLOCKING CALL
    return order;
}

// ❌ Important: ToList() in async method
public async Task<List<Product>> GetProducts()
{
    return _context.Products.ToList(); // Synchronous
}

// ❌ Important: Find() blocks thread
public async Task<Order> GetOrder(int id)
{
    return _context.Orders.Find(id); // Synchronous lookup
}

// ✓ Good: Async all the way
public async Task<Order> CreateOrder(CreateOrderRequest request)
{
    var order = new Order { ... };
    _context.Orders.Add(order);
    await _context.SaveChangesAsync(); // Non-blocking
    return order;
}

// ✓ Good: ToListAsync
public async Task<List<Product>> GetProducts()
{
    return await _context.Products.ToListAsync();
}

// ✓ Good: FindAsync
public async Task<Order> GetOrder(int id)
{
    return await _context.Orders.FindAsync(id);
}
```

**When to Flag:**
- **Important:** `SaveChanges()` instead of `SaveChangesAsync()`
- **Important:** `ToList()`, `FirstOrDefault()`, `Count()` instead of async versions
- **Important:** `Find()` instead of `FindAsync()`
- **Minor:** In truly synchronous methods (console apps), sync versions are fine

---

## Summary

**Critical Issues (Fix Immediately):**
- N+1 query problems
- SQL injection in raw SQL
- Loading entire tables
- Singleton DbContext

**High Priority:**
- Cartesian explosion with multiple Includes
- Missing AsNoTracking on read queries
- DbContext not disposed
- Connection string security

**Important:**
- Missing projections
- Lazy loading issues
- Migration anti-patterns
- Sync methods in async code

**Performance Checklist:**
1. Use `Include` or projections to avoid N+1
2. Use `AsNoTracking` for read-only queries
3. Use `AsSplitQuery` with multiple collection Includes
4. Never load entire tables without filtering
5. Project to DTOs instead of returning entities
6. Use `CountAsync` instead of loading for counts
7. Enable DbContext pooling for high-traffic apps
8. Always use async methods in ASP.NET Core
