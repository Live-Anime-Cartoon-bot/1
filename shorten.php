<?php
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, max-age=0");
header("X-Content-Type-Options: nosniff");

function respond($status, $payload) {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    header("Allow: POST");
    respond(405, ["error" => "Use POST to create a share link."]);
}

$contentType = strtolower(trim(explode(";", $_SERVER["CONTENT_TYPE"] ?? "")[0]));
if ($contentType !== "application/json") {
    respond(415, ["error" => "Unsupported request type."]);
}

$hostHeader = $_SERVER["HTTP_HOST"] ?? "";
if (!preg_match('/^[a-zA-Z0-9.-]+(?::[0-9]{1,5})?$/', $hostHeader)) {
    respond(400, ["error" => "Invalid site host."]);
}

// Reject cross-site browser requests. The browser client sends this endpoint
// a same-origin JSON POST; no wildcard CORS access is enabled.
$origin = $_SERVER["HTTP_ORIGIN"] ?? "";
if ($origin !== "") {
    $originHost = parse_url($origin, PHP_URL_HOST);
    $originPort = parse_url($origin, PHP_URL_PORT);
    $hostParts = parse_url("http://" . $hostHeader);
    $requestHost = $hostParts["host"] ?? "";
    $requestPort = $hostParts["port"] ?? null;
    if (
        !$originHost ||
        strtolower($originHost) !== strtolower($requestHost) ||
        $originPort !== $requestPort
    ) {
        respond(403, ["error" => "Cross-site requests are not allowed."]);
    }
}

$configPath = __DIR__ . "/shorten-config.php";
if (!is_file($configPath)) {
    respond(503, ["error" => "The ShrinkMe API key is not configured on the server."]);
}

require_once $configPath;
if (
    !defined("SHRINKME_API_KEY") ||
    trim(SHRINKME_API_KEY) === "" ||
    strpos(SHRINKME_API_KEY, "REPLACE_WITH_") === 0
) {
    respond(503, ["error" => "The ShrinkMe API key is not configured on the server."]);
}

if (!function_exists("curl_init")) {
    respond(503, ["error" => "PHP cURL is required for link creation."]);
}

// Limit repeated API calls from one address so a public endpoint cannot
// accidentally consume the publisher's ShrinkMe quota.
$clientIp = $_SERVER["REMOTE_ADDR"] ?? "unknown";
$rateFile = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
    . DIRECTORY_SEPARATOR
    . "jugnu-shrink-" . hash("sha256", $hostHeader . "|" . $clientIp) . ".txt";
$rateHandle = @fopen($rateFile, "c+");
if ($rateHandle !== false) {
    if (flock($rateHandle, LOCK_EX)) {
        $lastRequest = (int) trim(stream_get_contents($rateHandle));
        if ($lastRequest > 0 && time() - $lastRequest < 20) {
            flock($rateHandle, LOCK_UN);
            fclose($rateHandle);
            header("Retry-After: 20");
            respond(429, ["error" => "Please wait a few seconds before creating another link."]);
        }
        ftruncate($rateHandle, 0);
        rewind($rateHandle);
        fwrite($rateHandle, (string) time());
        fflush($rateHandle);
        flock($rateHandle, LOCK_UN);
    }
    fclose($rateHandle);
}

$isHttps = !empty($_SERVER["HTTPS"]) && strtolower($_SERVER["HTTPS"]) !== "off";
$destination = ($isHttps ? "https://" : "http://") . $hostHeader . "/";
$apiUrl = "https://shrinkme.io/api?" . http_build_query(
    ["api" => SHRINKME_API_KEY, "url" => $destination],
    "",
    "&",
    PHP_QUERY_RFC3986
);

$curl = curl_init($apiUrl);
curl_setopt_array($curl, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_FOLLOWLOCATION => false,
]);
$responseBody = curl_exec($curl);
$curlError = curl_error($curl);
$upstreamStatus = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);

if ($responseBody === false || $curlError !== "") {
    respond(502, ["error" => "ShrinkMe could not be reached. Try again later."]);
}

$response = json_decode($responseBody, true);
$shortUrl = is_array($response) ? ($response["shortenedUrl"] ?? "") : "";
$shortParts = is_string($shortUrl) ? parse_url($shortUrl) : false;

if (
    $upstreamStatus < 200 ||
    $upstreamStatus >= 300 ||
    !filter_var($shortUrl, FILTER_VALIDATE_URL) ||
    !$shortParts ||
    strtolower($shortParts["scheme"] ?? "") !== "https"
) {
    respond(502, ["error" => "ShrinkMe did not return a valid short link."]);
}

respond(200, ["shortUrl" => $shortUrl]);
