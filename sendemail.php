<?php
// Load PHPMailer
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\SMTP;

// Include PHPMailer files (Adjust the path according to your structure)
require 'PHPMailer/src/Exception.php';
require 'PHPMailer/src/PHPMailer.php';
require 'PHPMailer/src/SMTP.php';

// Check if form is submitted
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $userName = filter_var($_POST['username'], FILTER_SANITIZE_STRING);
    $senderEmail = filter_var($_POST['email'], FILTER_SANITIZE_EMAIL);
    $userPhone = filter_var($_POST['phone'], FILTER_SANITIZE_STRING);
    $userSubject = filter_var($_POST['subject'], FILTER_SANITIZE_STRING);
    $message = filter_var($_POST['message'], FILTER_SANITIZE_STRING);

    if (empty($userName) || empty($senderEmail) || empty($userPhone) || empty($userSubject) || empty($message)) {
        echo "All fields are required!";
        exit;
    }

    try {
        $mail = new PHPMailer(true);

        // SMTP Configuration
        $mail->isSMTP();
        $mail->Host = 'smtpout.secureserver.net'; // Change if needed
        $mail->SMTPAuth = true;
        $mail->Username = 'athulkrishna9633141960@gmail.com'; // Your email
        $mail->Password = 'athul@963314'; // Your email password
        $mail->SMTPSecure = 'ssl'; // 'tls' for 587, 'ssl' for 465
        $mail->Port = 465; 

        // Sender & Recipient
        $mail->setFrom('athulklive@gmail.com', 'Athul');
        $mail->addReplyTo($senderEmail, $userName);
        $mail->addAddress('athulklive@gmail.com', 'Company Email'); 
        $mail->addCC('athulklive@gmail.com', 'Sales Team');

        // Email Content
        $mail->isHTML(true);
        $mail->Subject = "New Enquiry: " . $userSubject;
        $mail->Body = "
            <h3>New Enquiry Details:</h3>
            <p><strong>Name:</strong> $userName</p>
            <p><strong>Email:</strong> $senderEmail</p>
            <p><strong>Phone:</strong> $userPhone</p>
            <p><strong>Subject:</strong> $userSubject</p>
            <p><strong>Message:</strong> $message</p>
        ";
        $mail->AltBody = "New Enquiry from $userName.\nEmail: $senderEmail\nPhone: $userPhone\nSubject: $userSubject\nMessage: $message";

        if ($mail->send()) {
            echo "Message has been sent successfully!";
        } else {
            echo "Message could not be sent.";
        }
    } catch (Exception $e) {
        echo "Mailer Error: " . $mail->ErrorInfo;
    }
} else {
    echo "Invalid request.";
}
?>
