import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../models/scanning_models.dart';

class ApiClient {
  static const String baseUrl = 'http://10.0.2.2:8000/api/v1'; // 10.0.2.2 for Android emulator
  static const _storage = FlutterSecureStorage();

  static final http.Client _client = http.Client();

  static String? _accessToken;
  static String? _refreshToken;

  // Initialize from secure storage
  static Future<void> init() async {
    _accessToken = await _storage.read(key: 'access_token');
    _refreshToken = await _storage.read(key: 'refresh_token');
  }

  static Future<void> saveTokens(String access, String refresh) async {
    _accessToken = access;
    _refreshToken = refresh;
    await _storage.write(key: 'access_token', value: access);
    await _storage.write(key: 'refresh_token', value: refresh);
  }

  static Future<void> clearTokens() async {
    _accessToken = null;
    _refreshToken = null;
    await _storage.delete(key: 'access_token');
    await _storage.delete(key: 'refresh_token');
  }

  static Map<String, String> _headers() {
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (_accessToken != null) {
      headers['Authorization'] = 'Bearer $_accessToken';
    }
    return headers;
  }

  static Future<bool> _refreshAccessToken() async {
    if (_refreshToken == null) return false;
    try {
      final response = await _client.post(
        Uri.parse('$baseUrl/auth/refresh/'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refresh': _refreshToken}),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        await saveTokens(data['access'], _refreshToken!);
        return true;
      }
    } catch (_) {}
    await clearTokens();
    return false;
  }

  static Future<http.Response> _request(
    String method,
    String endpoint, {
    Map<String, dynamic>? body,
    Map<String, String>? extraHeaders,
  }) async {
    final uri = Uri.parse('$baseUrl$endpoint');
    final headers = {..._headers(), ...?extraHeaders};

    http.Response response;
    switch (method) {
      case 'GET':
        response = await _client.get(uri, headers: headers);
        break;
      case 'POST':
        response = await _client.post(uri, headers: headers, body: body != null ? jsonEncode(body) : null);
        break;
      case 'PUT':
        response = await _client.put(uri, headers: headers, body: body != null ? jsonEncode(body) : null);
        break;
      case 'PATCH':
        response = await _client.patch(uri, headers: headers, body: body != null ? jsonEncode(body) : null);
        break;
      case 'DELETE':
        response = await _client.delete(uri, headers: headers);
        break;
      default:
        throw ArgumentError('Unsupported HTTP method: $method');
    }

    // Handle 401 - try refresh once
    if (response.statusCode == 401) {
      final refreshed = await _refreshAccessToken();
      if (refreshed) {
        final newHeaders = {..._headers(), ...?extraHeaders};
        switch (method) {
          case 'GET':
            response = await _client.get(uri, headers: newHeaders);
            break;
          case 'POST':
            response = await _client.post(uri, headers: newHeaders, body: body != null ? jsonEncode(body) : null);
            break;
          case 'PUT':
            response = await _client.put(uri, headers: newHeaders, body: body != null ? jsonEncode(body) : null);
            break;
          case 'PATCH':
            response = await _client.patch(uri, headers: newHeaders, body: body != null ? jsonEncode(body) : null);
            break;
          case 'DELETE':
            response = await _client.delete(uri, headers: newHeaders);
            break;
        }
      }
    }
    return response;
  }

  // Convenience methods
  static Future<http.Response> get(String endpoint) => _request('GET', endpoint);
  static Future<http.Response> post(String endpoint, {Map<String, dynamic>? body}) => _request('POST', endpoint, body: body);
  static Future<http.Response> put(String endpoint, {Map<String, dynamic>? body}) => _request('PUT', endpoint, body: body);
  static Future<http.Response> patch(String endpoint, {Map<String, dynamic>? body}) => _request('PATCH', endpoint, body: body);
  static Future<http.Response> delete(String endpoint) => _request('DELETE', endpoint);

  // Auth endpoints
  static Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await post('/auth/login/', body: {'email': email, 'password': password});
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      await saveTokens(data['access'], data['refresh']);
      return data;
    }
    throw Exception('Login failed: ${response.body}');
  }

  // Scanning endpoints
  static Future<Map<String, dynamic>> verifySessionKey(String key) async {
    final response = await post('/scanning/session/verify/', body: {'session_key': key});
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Session verification failed: ${response.body}');
  }

  static Future<Map<String, dynamic>> submitBooklet({
    required String sessionKey,
    required String physicalBarcode,
    required String dummyBarcode,
    required int pageCount,
    required List<String> pageFilePaths,
    required double ocrClarity,
    required String sha256Digest,
  }) async {
    final response = await post('/scanning/booklets/', body: {
      'session_key': sessionKey,
      'physical_barcode': physicalBarcode,
      'dummy_barcode': dummyBarcode,
      'page_count': pageCount,
      'page_file_paths': pageFilePaths,
      'ocr_clarity': ocrClarity,
      'sha256_digest': sha256Digest,
    });
    if (response.statusCode == 200 || response.statusCode == 201) {
      return jsonDecode(response.body);
    }
    throw Exception('Booklet submission failed: ${response.body}');
  }

  static Future<Map<String, dynamic>> reconcileBatch({
    required String sessionKey,
    required int totalBooklets,
    required int totalPages,
  }) async {
    final response = await post('/scanning/batch/reconcile/', body: {
      'session_key': sessionKey,
      'total_booklets': totalBooklets,
      'total_pages': totalPages,
    });
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Batch reconciliation failed: ${response.body}');
  }

  static Future<Map<String, dynamic>> getSessionStatus(String sessionKey) async {
    final response = await get('/scanning/session/status/?session_key=$sessionKey');
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Failed to get session status: ${response.body}');
  }
}