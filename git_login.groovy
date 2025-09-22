// save as github_auth_simple.groovy
def token = System.getenv('GITHUB_TOKEN')
if (!token) {
    System.err.println("Set GITHUB_TOKEN in environment before running.")
    System.exit(1)
}

def url = new URL("https://api.github.com/user")
def conn = (HttpURLConnection) url.openConnection()
conn.requestMethod = "GET"
conn.setRequestProperty("Accept", "application/vnd.github+json")
conn.setRequestProperty("Authorization", "token ${token}")
conn.setRequestProperty("User-Agent", "groovy-script")

def code = conn.responseCode
if (code >= 200 && code < 300) {
    def body = conn.inputStream.text
    println "Status: ${code}"
    println "Response:"
    println body
} else {
    def err = conn.errorStream?.text
    println "Failed: HTTP ${code}"
    if (err) println err
}
