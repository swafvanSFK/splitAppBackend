const { Notification, PushToken, UserGroup, User, Group } = require('../models');

async function sendGroupNotification(groupId, initiatorId, type, title, message, dataPayload = {}) {
  try {
    // 1. Get the group name (optional, but helpful for building message or validation)
    const group = await Group.findByPk(groupId);
    if (!group) {
      console.warn(`Group not found for notifications: ${groupId}`);
      return;
    }

    // 2. Fetch all members in the group
    const userGroups = await UserGroup.findAll({
      where: { group_id: groupId }
    });

    // 3. Filter out the initiator
    const recipients = userGroups.filter(ug => ug.user_id !== initiatorId);
    if (recipients.length === 0) return;

    // Create DB notifications and gather user IDs
    const recipientUserIds = recipients.map(r => r.user_id);
    
    // Create notifications in database
    const notificationPromises = recipientUserIds.map(userId => {
      return Notification.create({
        user_id: userId,
        group_id: groupId,
        type,
        title,
        message,
        is_read: false
      });
    });
    await Promise.all(notificationPromises);

    // 4. Fetch push tokens for all recipients
    const pushTokens = await PushToken.findAll({
      where: { user_id: recipientUserIds }
    });

    if (pushTokens.length === 0) {
      console.log('No push tokens registered for recipients.');
      return;
    }

    // 5. Structure push messages
    const messages = pushTokens.map(pt => ({
      to: pt.token,
      sound: 'default',
      title: title,
      body: message,
      data: {
        groupId,
        type,
        ...dataPayload
      }
    }));

    // 6. Send push request to Expo's Push Service API
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send push notifications via Expo:', errorText);
    } else {
      const responseData = await response.json();
      console.log('Push notifications sent successfully via Expo:', JSON.stringify(responseData));
    }
  } catch (error) {
    console.error('Error in sendGroupNotification helper:', error);
  }
}

module.exports = {
  sendGroupNotification
};
