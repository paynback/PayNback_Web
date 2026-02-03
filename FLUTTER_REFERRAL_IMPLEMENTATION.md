# Flutter Referral System Implementation Guide

## Overview

This guide explains how to implement the referral code system in your Flutter app. The referral system uses a **clipboard-based approach** for deferred deep linking, which works on both Android and iOS without requiring third-party services.

## How It Works

### Referral Flow

1. **User shares referral link**: `https://yourdomain.com/invite.html?code=ABC123&role=user`
2. **Recipient clicks link** → Opens `invite.html` page
3. **Page automatically copies referral code to clipboard**
4. **Page redirects to Play Store (Android) or App Store (iOS)**
5. **User installs and opens the app**
6. **App reads referral code from clipboard on first launch**
7. **App validates and applies the referral code during registration**

---

## Step 1: Add Required Dependencies

Add the following package to your `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  clipboard: ^0.1.3  # For reading clipboard
  shared_preferences: ^2.2.2  # For storing referral code
  http: ^1.1.0  # For API calls
  device_info_plus: ^9.1.0  # For device ID (optional, for attribution)
```

Then run:
```bash
flutter pub get
```

---

## Step 2: Create Referral Service

Create a new file: `lib/services/referral_service.dart`

```dart
import 'dart:async';
import 'package:clipboard/clipboard.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class ReferralService {
  static const String _referralCodeKey = 'pending_referral_code';
  static const String _referralCodeProcessedKey = 'referral_code_processed';
  static const String baseUrl = 'YOUR_API_BASE_URL'; // e.g., 'https://api.paynback.com'
  
  /// Check clipboard for referral code on app launch
  /// Call this method when app starts (in main.dart or splash screen)
  Future<String?> checkClipboardForReferralCode() async {
    try {
      // Read clipboard content
      final clipboardText = await FlutterClipboard.paste();
      
      if (clipboardText == null || clipboardText.isEmpty) {
        return null;
      }
      
      // Check if clipboard contains a valid referral code format
      // Referral codes are typically 6 characters (alphanumeric)
      // Adjust the validation pattern based on your actual code format
      final referralCodePattern = RegExp(r'^[A-Z0-9]{6}$'); // Example: 6 alphanumeric chars
      
      if (referralCodePattern.hasMatch(clipboardText.trim())) {
        final code = clipboardText.trim();
        
        // Check if we've already processed this code
        final prefs = await SharedPreferences.getInstance();
        final processedCodes = prefs.getStringList(_referralCodeProcessedKey) ?? [];
        
        if (processedCodes.contains(code)) {
          // Already processed, don't store again
          return null;
        }
        
        // Validate the code with backend before storing
        final isValid = await validateReferralCode(code);
        
        if (isValid) {
          // Store the referral code for later use during registration
          await prefs.setString(_referralCodeKey, code);
          
          // Mark as processed to avoid duplicate processing
          processedCodes.add(code);
          await prefs.setStringList(_referralCodeProcessedKey, processedCodes);
          
          return code;
        }
      }
      
      return null;
    } catch (e) {
      print('Error checking clipboard: $e');
      return null;
    }
  }
  
  /// Validate referral code with backend
  Future<bool> validateReferralCode(String code) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/public/referral/validate'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'referralCode': code,
        }),
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['success'] == true && data['data']['valid'] == true;
      }
      
      return false;
    } catch (e) {
      print('Error validating referral code: $e');
      return false;
    }
  }
  
  /// Get pending referral code (to be used during registration)
  Future<String?> getPendingReferralCode() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(_referralCodeKey);
    } catch (e) {
      print('Error getting pending referral code: $e');
      return null;
    }
  }
  
  /// Clear referral code after successful registration
  Future<void> clearReferralCode() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_referralCodeKey);
    } catch (e) {
      print('Error clearing referral code: $e');
    }
  }
  
  /// Register referral attribution (optional, for analytics)
  /// Call this after validating the code
  Future<bool> registerAttribution(String referralCode, {String? deviceId}) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/public/referral/register-attribution'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'referralCode': referralCode,
          if (deviceId != null) 'deviceId': deviceId,
        }),
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['success'] == true;
      }
      
      return false;
    } catch (e) {
      print('Error registering attribution: $e');
      return false;
    }
  }
}
```

---

## Step 3: Initialize Referral Check on App Launch

Update your `lib/main.dart` or splash screen to check clipboard on app launch:

```dart
import 'package:flutter/material.dart';
import 'services/referral_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Check clipboard for referral code on app launch
  final referralService = ReferralService();
  await referralService.checkClipboardForReferralCode();
  
  runApp(MyApp());
}
```

**Important**: Only check clipboard on **first launch** or when the app is opened for the first time after installation. You can use `shared_preferences` to track if this is the first launch:

```dart
Future<bool> isFirstLaunch() async {
  final prefs = await SharedPreferences.getInstance();
  final isFirst = prefs.getBool('is_first_launch') ?? true;
  if (isFirst) {
    await prefs.setBool('is_first_launch', false);
  }
  return isFirst;
}

// In main.dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  final referralService = ReferralService();
  final prefs = await SharedPreferences.getInstance();
  final isFirst = prefs.getBool('is_first_launch') ?? true;
  
  if (isFirst) {
    // Check clipboard only on first launch
    await referralService.checkClipboardForReferralCode();
    await prefs.setBool('is_first_launch', false);
  }
  
  runApp(MyApp());
}
```

---

## Step 4: Use Referral Code During Registration

When the user registers or verifies OTP, retrieve and send the referral code to the backend:

### Example: During OTP Verification

```dart
import 'services/referral_service.dart';

class AuthService {
  final ReferralService _referralService = ReferralService();
  
  Future<AuthResponse> verifyOtp(String phone, String otp) async {
    // Get pending referral code
    final referralCode = await _referralService.getPendingReferralCode();
    
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/user/verify-auth'), // Adjust endpoint as needed
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'phoneNumber': phone,
          'otp': otp,
          if (referralCode != null) 'referralCode': referralCode,
        }),
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        
        // Clear referral code after successful registration
        if (referralCode != null) {
          await _referralService.clearReferralCode();
        }
        
        return AuthResponse.fromJson(data);
      } else {
        throw Exception('Failed to verify OTP');
      }
    } catch (e) {
      print('Error verifying OTP: $e');
      rethrow;
    }
  }
}
```

### Example: During User Registration

```dart
Future<User> registerUser({
  required String phone,
  required String name,
  // ... other fields
}) async {
  // Get pending referral code
  final referralCode = await _referralService.getPendingReferralCode();
  
  final response = await http.post(
    Uri.parse('$baseUrl/api/user/register'), // Adjust endpoint as needed
    headers: {
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'phone': phone,
      'name': name,
      if (referralCode != null) 'referralCode': referralCode,
      // ... other fields
    }),
  );
  
  if (response.statusCode == 200 || response.statusCode == 201) {
    // Clear referral code after successful registration
    if (referralCode != null) {
      await _referralService.clearReferralCode();
    }
    
    return User.fromJson(jsonDecode(response.body));
  } else {
    throw Exception('Registration failed');
  }
}
```

---

## Step 5: Platform-Specific Considerations

### Android

**Permissions**: Add clipboard read permission to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.READ_CLIPBOARD" />
```

**Note**: On Android 10+ (API 29+), clipboard access is restricted. The app can only read clipboard when it's in the foreground. This is fine for our use case since we check on app launch.

### iOS

**Info.plist**: No special permissions needed for clipboard access in iOS. However, you may want to add a usage description:

```xml
<key>NSUserTrackingUsageDescription</key>
<string>We use this to track referral codes</string>
```

**Note**: iOS allows clipboard access without special permissions, but starting from iOS 14, the system shows a notification when an app reads from clipboard. This is expected behavior.

---

## Step 6: Handle Edge Cases

### 1. Multiple Clipboard Checks

To avoid processing the same code multiple times, the service already tracks processed codes. However, you can add additional safeguards:

```dart
// Only check clipboard if app was installed recently (e.g., within last 24 hours)
Future<bool> shouldCheckClipboard() async {
  final prefs = await SharedPreferences.getInstance();
  final installTime = prefs.getInt('app_install_time');
  
  if (installTime == null) {
    await prefs.setInt('app_install_time', DateTime.now().millisecondsSinceEpoch);
    return true;
  }
  
  final installDate = DateTime.fromMillisecondsSinceEpoch(installTime);
  final hoursSinceInstall = DateTime.now().difference(installDate).inHours;
  
  return hoursSinceInstall < 24; // Only check within 24 hours of install
}
```

### 2. Invalid Referral Codes

The service validates codes with the backend before storing them. Invalid codes are automatically rejected.

### 3. User Already Has Referral Code

If the user already has a referral code applied, you should skip applying a new one. The backend should handle this, but you can also check on the frontend:

```dart
// Check if user already has a referrer
if (user.referredBy != null) {
  // User already has a referrer, don't apply new code
  await _referralService.clearReferralCode();
  return;
}
```

### 4. Clipboard Contains Non-Referral Text

The service uses regex pattern matching to ensure only valid referral codes are processed. Adjust the pattern based on your actual code format:

```dart
// Example patterns:
// 6 alphanumeric: RegExp(r'^[A-Z0-9]{6}$')
// Alphanumeric with prefix: RegExp(r'^PNDBREF@[A-Z0-9]{12}$')
// Custom format: RegExp(r'^YOUR_PATTERN$')
```

---

## Step 7: Testing

### Test Scenarios

1. **Fresh Install with Referral Code**:
   - Copy a referral code to clipboard
   - Install and launch the app
   - Verify code is detected and stored
   - Complete registration
   - Verify code is applied

2. **App Already Installed**:
   - Copy a referral code to clipboard
   - Open the app (not first launch)
   - Verify code is NOT processed (only on first launch)

3. **Invalid Referral Code**:
   - Copy invalid text to clipboard
   - Launch app
   - Verify code is NOT stored

4. **Multiple Referral Codes**:
   - Copy code A, launch app
   - Copy code B, launch app again
   - Verify only code A is processed (first launch only)

### Manual Testing

```dart
// Add this to a debug screen for testing
class ReferralTestScreen extends StatefulWidget {
  @override
  _ReferralTestScreenState createState() => _ReferralTestScreenState();
}

class _ReferralTestScreenState extends State<ReferralTestScreen> {
  final _referralService = ReferralService();
  String? _pendingCode;
  
  @override
  void initState() {
    super.initState();
    _loadPendingCode();
  }
  
  Future<void> _loadPendingCode() async {
    final code = await _referralService.getPendingReferralCode();
    setState(() {
      _pendingCode = code;
    });
  }
  
  Future<void> _checkClipboard() async {
    final code = await _referralService.checkClipboardForReferralCode();
    setState(() {
      _pendingCode = code;
    });
    
    if (code != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Referral code found: $code')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No referral code found')),
      );
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Referral Test')),
      body: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Pending Referral Code: ${_pendingCode ?? "None"}'),
            SizedBox(height: 16),
            ElevatedButton(
              onPressed: _checkClipboard,
              child: Text('Check Clipboard'),
            ),
            SizedBox(height: 16),
            ElevatedButton(
              onPressed: () async {
                await _referralService.clearReferralCode();
                await _loadPendingCode();
              },
              child: Text('Clear Referral Code'),
            ),
          ],
        ),
      ),
    );
  }
}
```

---

## API Endpoints Reference

### 1. Validate Referral Code
```
POST /api/public/referral/validate
Content-Type: application/json

Body:
{
  "referralCode": "ABC123"
}

Response:
{
  "success": true,
  "data": {
    "valid": true
  }
}
```

### 2. Register Attribution (Optional)
```
POST /api/public/referral/register-attribution
Content-Type: application/json

Body:
{
  "referralCode": "ABC123",
  "deviceId": "optional-device-id"
}

Response:
{
  "success": true,
  "data": {
    "success": true
  }
}
```

### 3. Generate Referral Link (For Sharing)
```
GET /api/referral/link
Headers: {
  "Authorization": "Bearer <token>"
}

Response:
{
  "referralLink": "https://yourdomain.com/invite.html?code=ABC123&role=user",
  "message": "Join Paynback – the fastest way to earn amazing rewards..."
}
```

---

## Best Practices

1. **Check Clipboard Only on First Launch**: Avoid checking clipboard every time the app opens. Only check on first launch or within a short time window after installation.

2. **Validate Before Storing**: Always validate referral codes with the backend before storing them locally.

3. **Clear After Use**: Clear the stored referral code after successful registration to prevent reuse.

4. **Handle Errors Gracefully**: Don't block user registration if referral code validation fails. Log the error but allow registration to proceed.

5. **User Feedback**: Optionally show a message to the user when a referral code is detected: "We found a referral code! You'll get rewards after registration."

6. **Privacy**: Be transparent about clipboard access. Consider showing a brief explanation to users about why you're accessing the clipboard.

---

## Troubleshooting

### Clipboard Not Working on Android 10+

**Issue**: Clipboard access is restricted on Android 10+.

**Solution**: Ensure the app is in the foreground when reading clipboard. The code already handles this correctly.

### iOS Shows Clipboard Notification

**Issue**: iOS 14+ shows a notification when app reads clipboard.

**Solution**: This is expected behavior. You can't disable it, but you can inform users about it in your app's privacy policy.

### Referral Code Not Detected

**Possible Causes**:
1. Clipboard was cleared before app launch
2. Code format doesn't match the regex pattern
3. Code validation failed on backend
4. Code was already processed

**Debug Steps**:
1. Check if clipboard contains the code manually
2. Verify regex pattern matches your code format
3. Check backend logs for validation errors
4. Check SharedPreferences for processed codes list

---

## Summary

The referral system works as follows:

1. ✅ User clicks referral link → Code copied to clipboard → Redirects to app store
2. ✅ User installs app → App launches → Checks clipboard on first launch
3. ✅ Valid referral code found → Stored locally → Validated with backend
4. ✅ User registers → Referral code sent to backend → Code applied
5. ✅ Referral code cleared from local storage

This approach works reliably on both Android and iOS without requiring third-party services or complex deep linking setup.

---

## Support

If you encounter any issues, check:
1. Backend API endpoints are accessible
2. Clipboard permissions are properly configured
3. Referral code format matches the regex pattern
4. Backend validation is working correctly

For questions or issues, contact the backend team.

