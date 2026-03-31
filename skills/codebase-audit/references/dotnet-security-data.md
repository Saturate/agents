# .NET Security: Data Security

Security patterns for SQL injection, deserialization, mass assignment, input validation, and XXE attacks in .NET 6+ applications.

## Table of Contents

- [SQL Injection](#sql-injection)
- [Deserialization Attacks](#deserialization-attacks)
- [Mass Assignment](#mass-assignment)
- [Input Validation](#input-validation)
- [XXE (XML External Entity)](#xxe-xml-external-entity)

## SQL Injection

**Critical:** String concatenation in SQL queries allows attackers to inject malicious SQL.

### Detection Patterns

```bash
# Find ADO.NET string concatenation
grep -rn "SqlCommand.*+\|new SqlCommand.*\$" --include="*.cs" .

# Find Dapper interpolation vulnerabilities
grep -rn "Query.*\$\"\|Execute.*\$\"" --include="*.cs" .

# Find Entity Framework raw SQL issues (covered in entity-framework.md)
grep -rn "FromSqlRaw.*\$\|ExecuteSqlRaw.*\$" --include="*.cs" .
```

### Vulnerable Code

```csharp
// ❌ Critical: ADO.NET string concatenation
public User GetUser(string username)
{
    var query = "SELECT * FROM Users WHERE Username = '" + username + "'";
    var command = new SqlCommand(query, connection);
    // Attack: username = "admin'--"
}

// ❌ Critical: String interpolation in SqlCommand
public List<Order> GetOrders(string status)
{
    var command = new SqlCommand($"SELECT * FROM Orders WHERE Status = '{status}'", connection);
    // Attack: status = "' OR '1'='1"
}

// ❌ Critical: Dapper with string interpolation
public async Task<User> GetUser(string email)
{
    return await connection.QueryFirstOrDefaultAsync<User>(
        $"SELECT * FROM Users WHERE Email = '{email}'");
    // Attack: email = "' OR 1=1--"
}

// ❌ Critical: Dynamic SQL in Dapper
public async Task<IEnumerable<Product>> SearchProducts(string searchTerm)
{
    var sql = "SELECT * FROM Products WHERE Name LIKE '%" + searchTerm + "%'";
    return await connection.QueryAsync<Product>(sql);
}

// ✓ Good: ADO.NET with parameters
public User GetUser(string username)
{
    var query = "SELECT * FROM Users WHERE Username = @username";
    var command = new SqlCommand(query, connection);
    command.Parameters.AddWithValue("@username", username);
    return ExecuteQuery(command);
}

// ✓ Good: Dapper with parameters
public async Task<User> GetUser(string email)
{
    return await connection.QueryFirstOrDefaultAsync<User>(
        "SELECT * FROM Users WHERE Email = @Email",
        new { Email = email });
}

// ✓ Good: Entity Framework LINQ (safe by default)
public async Task<User> GetUser(string username)
{
    return await _context.Users
        .Where(u => u.Username == username)
        .FirstOrDefaultAsync();
}

// ✓ Good: EF Core FromSqlRaw with parameters
public async Task<List<Order>> GetOrders(string status)
{
    return await _context.Orders
        .FromSqlRaw("SELECT * FROM Orders WHERE Status = {0}", status)
        .ToListAsync();
}
```

**When to Flag:**
- **Critical:** String concatenation or interpolation in SQL queries
- **Critical:** Dynamic SQL construction with user input
- **High:** Raw SQL without parameterization

## Deserialization Attacks

**Critical:** Unsafe deserialization can lead to remote code execution.

### Detection Patterns

```bash
# Find BinaryFormatter usage (critical)
grep -rn "BinaryFormatter\|IFormatter" --include="*.cs" .

# Find unsafe JSON.NET TypeNameHandling
grep -rn "TypeNameHandling\.All\|TypeNameHandling\.Auto" --include="*.cs" .

# Find XmlSerializer with user-controlled types
grep -rn "XmlSerializer" --include="*.cs" .

# Find DataContractSerializer
grep -rn "DataContractSerializer\|NetDataContractSerializer" --include="*.cs" .
```

### Vulnerable Code

```csharp
// ❌ Critical: BinaryFormatter (RCE vulnerability)
public object DeserializeData(byte[] data)
{
    var formatter = new BinaryFormatter();
    using var stream = new MemoryStream(data);
    return formatter.Deserialize(stream); // REMOTE CODE EXECUTION
}

// ❌ Critical: JSON.NET with TypeNameHandling.All
public class ApiController : ControllerBase
{
    [HttpPost]
    public IActionResult ProcessData([FromBody] string json)
    {
        var settings = new JsonSerializerSettings
        {
            TypeNameHandling = TypeNameHandling.All // Allows arbitrary type instantiation
        };
        var obj = JsonConvert.DeserializeObject(json, settings);
        return Ok(obj);
    }
}

// ❌ Critical: NetDataContractSerializer (unsafe)
public object DeserializeContract(string xml)
{
    var serializer = new NetDataContractSerializer();
    using var reader = new StringReader(xml);
    return serializer.ReadObject(XmlReader.Create(reader)); // RCE risk
}

// ❌ High: XmlSerializer with user-controlled type
public object DeserializeXml(string xml, string typeName)
{
    var type = Type.GetType(typeName); // User controls type
    var serializer = new XmlSerializer(type);
    using var reader = new StringReader(xml);
    return serializer.Deserialize(reader);
}

// ✓ Good: System.Text.Json (safe by default)
public IActionResult ProcessData([FromBody] string json)
{
    var options = new JsonSerializerOptions
    {
        // No type handling, explicit type required
    };
    var order = JsonSerializer.Deserialize<Order>(json, options);
    return Ok(order);
}

// ✓ Good: JSON.NET with explicit type and validation
public IActionResult ProcessData([FromBody] string json)
{
    var settings = new JsonSerializerSettings
    {
        TypeNameHandling = TypeNameHandling.None, // Safest option
        MaxDepth = 32 // Prevent DoS
    };
    var order = JsonConvert.DeserializeObject<Order>(json, settings);
    return Ok(order);
}

// ✓ Good: XmlSerializer with known type only
public Order DeserializeOrder(string xml)
{
    var serializer = new XmlSerializer(typeof(Order)); // Fixed type
    using var reader = new StringReader(xml);
    return (Order)serializer.Deserialize(reader);
}
```

**When to Flag:**
- **Critical:** Any use of `BinaryFormatter` (immediate removal required)
- **Critical:** `TypeNameHandling.All` or `TypeNameHandling.Auto`
- **Critical:** `NetDataContractSerializer`
- **High:** User-controlled type names in deserialization

**Mitigation:**
- Migrate from BinaryFormatter to JSON or MessagePack
- Use `System.Text.Json` instead of `Newtonsoft.Json` when possible
- Never use `TypeNameHandling.All` or `TypeNameHandling.Auto`
- Validate input before deserialization

## Mass Assignment

**High:** Binding user input directly to entities allows unauthorized property updates.

### Detection Patterns

```bash
# Find direct model binding to entities
grep -rn "\[FromBody\].*DbContext\|\[FromBody\].*Entity" --include="*.cs" .

# Find UpdateModel/TryUpdateModel
grep -rn "UpdateModel\|TryUpdateModel" --include="*.cs" .

# Check for DTOs vs entities
find . -name "*Dto.cs" -o -name "*Request.cs" -o -name "*Command.cs"
```

### Vulnerable Code

```csharp
// ❌ Critical: Direct entity binding
[HttpPost]
public async Task<IActionResult> CreateUser([FromBody] User user)
{
    // Attacker can set: IsAdmin = true, Role = "Admin", etc.
    _context.Users.Add(user);
    await _context.SaveChangesAsync();
    return Ok(user);
}

// ❌ High: UpdateModel without restrictions
[HttpPut("{id}")]
public async Task<IActionResult> UpdateUser(int id, [FromBody] User updates)
{
    var user = await _context.Users.FindAsync(id);
    await TryUpdateModelAsync(user); // Can update any property
    await _context.SaveChangesAsync();
    return Ok(user);
}

// ❌ High: Partial update without validation
[HttpPatch("{id}")]
public async Task<IActionResult> PatchUser(int id, [FromBody] JsonPatchDocument<User> patch)
{
    var user = await _context.Users.FindAsync(id);
    patch.ApplyTo(user); // Can modify IsAdmin, Salary, etc.
    await _context.SaveChangesAsync();
    return Ok(user);
}

// ✓ Good: DTO pattern
public class CreateUserRequest
{
    public string Username { get; set; }
    public string Email { get; set; }
    // No IsAdmin, Role, or sensitive properties
}

[HttpPost]
public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
{
    var user = new User
    {
        Username = request.Username,
        Email = request.Email,
        Role = "User", // Set server-side
        CreatedAt = DateTime.UtcNow
    };

    _context.Users.Add(user);
    await _context.SaveChangesAsync();
    return Ok(user);
}

// ✓ Good: Explicit property updates
[HttpPut("{id}")]
public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserRequest request)
{
    var user = await _context.Users.FindAsync(id);
    if (user == null) return NotFound();

    // Explicit updates only
    user.Username = request.Username;
    user.Email = request.Email;
    // IsAdmin, Role, etc. cannot be modified

    await _context.SaveChangesAsync();
    return Ok(user);
}

// ✓ Good: Validation with [Bind] attribute
[HttpPost]
public async Task<IActionResult> CreateUser([Bind("Username,Email")] User user)
{
    // Only Username and Email can be bound
    _context.Users.Add(user);
    await _context.SaveChangesAsync();
    return Ok(user);
}
```

**When to Flag:**
- **Critical:** Direct entity binding in `[FromBody]` without DTO
- **High:** `UpdateModel`/`TryUpdateModel` without property restrictions
- **High:** `JsonPatchDocument<TEntity>` on entities (use DTOs)
- **Important:** Missing `[Bind]` attribute when binding to entities

## Input Validation

**High:** Missing input validation allows malicious data injection.

### Detection Patterns

```bash
# Find validation attributes
grep -rn "\[Required\]\|\[StringLength\]\|\[Range\]" --include="*.cs" .

# Find FluentValidation
grep -rn "AbstractValidator\|RuleFor" --include="*.cs" .

# Check for manual validation
grep -rn "ModelState\.IsValid" --include="*.cs" .

# Find unvalidated user input
grep -rn "\[FromBody\].*string\|\[FromQuery\].*string" --include="*.cs" .
```

### Vulnerable Code

```csharp
// ❌ High: No input validation
public class CreateUserRequest
{
    public string Username { get; set; } // No constraints
    public string Email { get; set; }
    public int Age { get; set; }
}

[HttpPost]
public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
{
    // No ModelState.IsValid check
    var user = new User
    {
        Username = request.Username, // Could be null, empty, or malicious
        Email = request.Email
    };
    await _userService.CreateAsync(user);
    return Ok();
}

// ❌ High: Insufficient validation
public class CreateOrderRequest
{
    [Required]
    public string ProductId { get; set; } // No format validation

    public int Quantity { get; set; } // No range check (could be negative)
}

// ✓ Good: Data annotations with validation
public class CreateUserRequest
{
    [Required(ErrorMessage = "Username is required")]
    [StringLength(50, MinimumLength = 3)]
    [RegularExpression(@"^[a-zA-Z0-9_]+$")]
    public string Username { get; set; }

    [Required]
    [EmailAddress]
    [StringLength(100)]
    public string Email { get; set; }

    [Range(13, 120)]
    public int Age { get; set; }
}

[HttpPost]
public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
{
    if (!ModelState.IsValid)
    {
        return BadRequest(ModelState);
    }

    var user = new User
    {
        Username = request.Username,
        Email = request.Email,
        Age = request.Age
    };

    await _userService.CreateAsync(user);
    return Ok();
}

// ✓ Good: FluentValidation
public class CreateOrderRequestValidator : AbstractValidator<CreateOrderRequest>
{
    public CreateOrderRequestValidator()
    {
        RuleFor(x => x.ProductId)
            .NotEmpty()
            .Matches(@"^[A-Z0-9]{8}$")
            .WithMessage("Invalid product ID format");

        RuleFor(x => x.Quantity)
            .InclusiveBetween(1, 1000)
            .WithMessage("Quantity must be between 1 and 1000");

        RuleFor(x => x.ShippingAddress)
            .NotEmpty()
            .MaximumLength(200);
    }
}
```

**When to Flag:**
- **High:** Request models without validation attributes
- **High:** Missing `ModelState.IsValid` checks
- **Important:** String properties without length constraints
- **Important:** Numeric properties without range validation

## XXE (XML External Entity)

**High:** Unsafe XML parsing allows file disclosure and SSRF attacks.

### Detection Patterns

```bash
# Find XmlReader/XmlDocument usage
grep -rn "XmlReader\|XmlDocument\|XDocument" --include="*.cs" .

# Find XmlSerializer
grep -rn "XmlSerializer" --include="*.cs" .

# Check for DTD processing
grep -rn "DtdProcessing\|ProhibitDtd" --include="*.cs" .
```

### Vulnerable Code

```csharp
// ❌ High: XmlDocument with DTD enabled (default in .NET Framework)
public void ParseXml(string xml)
{
    var doc = new XmlDocument();
    doc.LoadXml(xml); // XXE vulnerable in .NET Framework
    // Attack: <!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
}

// ❌ High: XmlReader with unsafe settings
public void ParseXml(string xml)
{
    var settings = new XmlReaderSettings
    {
        DtdProcessing = DtdProcessing.Parse // Enables XXE
    };
    using var reader = XmlReader.Create(new StringReader(xml), settings);
    // Vulnerable to XXE
}

// ✓ Good: XmlDocument with DTD disabled (.NET Core default is safe)
public void ParseXml(string xml)
{
    var doc = new XmlDocument();
    doc.XmlResolver = null; // Disable external entity resolution
    doc.LoadXml(xml);
}

// ✓ Good: XmlReader with safe settings
public void ParseXml(string xml)
{
    var settings = new XmlReaderSettings
    {
        DtdProcessing = DtdProcessing.Prohibit, // Disable DTD
        XmlResolver = null // Disable external entities
    };
    using var reader = XmlReader.Create(new StringReader(xml), settings);
    // Safe from XXE
}

// ✓ Good: LINQ to XML (safe by default in .NET Core)
public void ParseXml(string xml)
{
    var doc = XDocument.Parse(xml); // Safe in .NET Core
}
```

**When to Flag:**
- **High:** `XmlDocument` without `XmlResolver = null` (in .NET Framework projects)
- **High:** `DtdProcessing.Parse` in `XmlReaderSettings`
- **Important:** XML parsing without explicit XXE mitigation
- **Minor:** .NET Core 6+ projects (safe by default, but verify)


---

## Cross-Reference

For related security topics:
- Authentication and authorization: See [dotnet-security-auth.md](dotnet-security-auth.md)
- Cryptography and secrets: See [dotnet-security-crypto.md](dotnet-security-crypto.md)
- SQL injection in Entity Framework: See [entity-framework.md](entity-framework.md)
- General OWASP Top 10 patterns: See [owasp-top-10.md](owasp-top-10.md)
- Framework-level security: See [framework-patterns-dotnet.md](framework-patterns-dotnet.md)
