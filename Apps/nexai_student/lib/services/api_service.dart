import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String baseUrl = 'http://127.0.0.1:8000/api/v1';
  static const String _accessKey = 'nexai_jwt_token';
  static const String _refreshKey = 'nexai_refresh_token';

  // ── Token Management ─────────────────────────────────────────────────────
  static Future<void> saveTokens(String access, String refresh) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_accessKey, access);
    await prefs.setString(_refreshKey, refresh);
  }

  static Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_accessKey, token);
  }

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_accessKey);
  }

  static Future<String?> getRefreshToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_refreshKey);
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_accessKey);
    await prefs.remove(_refreshKey);
  }

  // ── Token Refresh ─────────────────────────────────────────────────────────
  /// Attempts to use the refresh token to get a new access token.
  /// Returns the new access token string or null if refresh fails.
  static Future<String?> _refreshAccessToken() async {
    final refreshToken = await getRefreshToken();
    if (refreshToken == null) return null;

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/token/refresh/'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refresh': refreshToken}),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final newAccess = data['access'] as String?;
        if (newAccess != null) {
          await saveToken(newAccess);
          return newAccess;
        }
      }
    } catch (_) {}
    return null;
  }

  // ── GET ───────────────────────────────────────────────────────────────────
  static Future<dynamic> get(String endpoint) async {
    var token = await getToken();
    var response = await http.get(
      Uri.parse('$baseUrl$endpoint'),
      headers: {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      },
    );

    // Auto-refresh on 401
    if (response.statusCode == 401) {
      token = await _refreshAccessToken();
      if (token != null) {
        response = await http.get(
          Uri.parse('$baseUrl$endpoint'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
        );
      }
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to load data: ${response.statusCode} - ${response.body}');
    }
  }

  // ── POST ──────────────────────────────────────────────────────────────────
  static Future<dynamic> post(String endpoint, Map<String, dynamic> body) async {
    var token = await getToken();
    var response = await http.post(
      Uri.parse('$baseUrl$endpoint'),
      headers: {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      },
      body: jsonEncode(body),
    );

    // Auto-refresh on 401
    if (response.statusCode == 401) {
      token = await _refreshAccessToken();
      if (token != null) {
        response = await http.post(
          Uri.parse('$baseUrl$endpoint'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode(body),
        );
      }
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return jsonDecode(response.body);
    } else {
      try {
        final parsed = jsonDecode(response.body);
        final detail = parsed['detail'] ?? parsed['error'] ?? parsed['message'];
        if (detail != null) throw Exception(detail);
      } catch (e) {
        if (e is Exception) rethrow;
      }
      throw Exception('Request failed: ${response.statusCode} - ${response.body}');
    }
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  /// Returns null on success, error message string on failure.
  static Future<String?> login(String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login/'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email, 'password': password}),
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final data = jsonDecode(response.body);
        final access = data['access'] as String?;
        final refresh = data['refresh'] as String?;
        if (access != null && refresh != null) {
          await saveTokens(access, refresh);
          return null; // success
        }
        return 'Login failed: unexpected server response';
      }

      // Parse error
      try {
        final parsed = jsonDecode(response.body);
        final detail = parsed['detail'] ?? parsed['error'] ?? parsed['message'];
        return detail?.toString() ?? 'Login failed. Check your credentials.';
      } catch (_) {
        return 'Login failed. Check your credentials.';
      }
    } catch (e) {
      return e.toString().replaceAll('Exception: ', '');
    }
  }
}
