using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var root = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, ".."));
Console.WriteLine($"Hosting files from: {root}");

app.UseFileServer(new FileServerOptions
{
    FileProvider = new PhysicalFileProvider(root),
    RequestPath = "",
    EnableDirectoryBrowsing = true
});

app.Run("http://localhost:8000");
