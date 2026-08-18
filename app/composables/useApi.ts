export function $api<T>(path: string, options: {
  method?: 'get' | 'post' | 'patch' | 'delete'
  body?: Record<string, unknown> | FormData | string | null
  params?: Record<string, string | number | undefined>
  serverUrl?: string
  token?: string
} = {}): Promise<T> {
  const { activeAccount } = useAccounts()

  const serverUrl = options.serverUrl ?? activeAccount.value?.serverUrl
  const token = options.token ?? activeAccount.value?.token

  if (!serverUrl || !token) {
    throw new Error('No active account or missing server URL/token')
  }

  return $fetch<T>(path, {
    baseURL: serverUrl,
    method: options.method ?? 'get',
    body: options.body,
    params: options.params,
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
}

export function useApi() {
  return {
    // User
    async getMe() {
      return $api<AccountUser>('/api/user/me')
    },

    async updateUser(data: { name: string, email: string }) {
      return $api<{ success: boolean }>('/api/user/update', { method: 'patch', body: data })
    },

    async uploadAvatar(file: File) {
      const form = new FormData()
      form.append('file', file)
      return $api<{ avatarUrl: string }>('/api/user/avatar', { method: 'patch', body: form })
    },

    async getUserProfile(username: string) {
      return $api<{
        user: { id: number, username: string, name: string, avatarUrl: string | null, createdAt: string }
        stats: { photoCount: number, commentCount: number, joinedDate: string }
        groupsInCommon: { id: number, name: string, slug: string, icon: string | null, color: string | null }[]
      }>(`/api/users/${username}`)
    },

    async getUserPhotos(username: string, params?: { limit?: number, before?: number }) {
      return $api<{ photos: PostData[], nextCursor: number | null }>(`/api/users/${username}/photos`, { params })
    },

    async completeOobe() {
      return $api<{ success: boolean }>('/api/user/oobe/complete', { method: 'post' })
    },

    // Photos
    async getFeed(params?: { limit?: number, before?: number, after?: number }) {
      return $api<{ photos: PostData[], nextCursor: number | null }>('/api/photos', { params })
    },

    async getPhoto(id: number) {
      return $api<PostData>(`/api/photos/${id}`)
    },

    async uploadPhoto(formData: FormData) {
      return $api<{
        id: number
        userId: number
        caption: string | null
        blobPathname: string
        createdAt: string
        captionEditedAt: string | null
        captionHistory: Array<{ text: string | null, editedAt: string }> | null
        isMoment: boolean
        momentCapturedAt: string | null
        url: string
      }>('/api/photos', { method: 'post', body: formData })
    },

    async editCaption(id: number, caption: string | null) {
      return $api<PostData>(`/api/photos/${id}`, { method: 'patch', body: { caption } })
    },

    async deletePhoto(id: number) {
      return $api<{ success: boolean }>(`/api/photos/${id}`, { method: 'delete' })
    },

    // Likes
    async getLikes(photoId: number) {
      return $api<{ liked: boolean, count: number }>(`/api/photos/${photoId}/likes`)
    },

    async toggleLike(photoId: number) {
      return $api<{ liked: boolean, count: number }>(`/api/photos/${photoId}/likes`, { method: 'post' })
    },

    // Comments
    async getComments(photoId: number) {
      return $api<CommentItem[]>(`/api/photos/${photoId}/comments`)
    },

    async addComment(photoId: number, body: string) {
      return $api<CommentItem>(`/api/photos/${photoId}/comments`, { method: 'post', body: { body } })
    },

    async editComment(commentId: number, body: string) {
      return $api<CommentItem>(`/api/comments/${commentId}`, { method: 'patch', body: { body } })
    },

    async toggleReaction(commentId: number, type: ReactionType) {
      return $api<{ counts: ReactionCounts, myReaction: ReactionType | null }>(`/api/comments/${commentId}/reactions`, { method: 'post', body: { type } })
    },

    // Groups
    async getGroups() {
      return $api<{ groups: GroupData[] }>('/api/groups')
    },

    async getGroup(id: number) {
      return $api<GroupData>(`/api/groups/${id}`)
    },

    async createGroup(data: { name: string, icon?: string, color?: string }) {
      return $api<GroupData>('/api/groups', { method: 'post', body: data })
    },

    async updateGroup(id: number, data: { name?: string, icon?: string, color?: string, momentsEnabled?: boolean }) {
      return $api<GroupData>(`/api/groups/${id}`, { method: 'patch', body: data })
    },

    async deleteGroup(id: number) {
      return $api<{ ok: boolean }>(`/api/groups/${id}`, { method: 'delete' })
    },

    async leaveGroup(id: number) {
      return $api<{ ok: boolean }>(`/api/groups/${id}/leave`, { method: 'post' })
    },

    // Group Invites
    async getGroupInvites(groupId: number) {
      return $api<{ invites: GroupInvite[] }>(`/api/groups/${groupId}/invites`)
    },

    async createGroupInvite(groupId: number, data: { maxUses?: number, expiresInHours?: number }) {
      return $api<GroupInvite>(`/api/groups/${groupId}/invites`, { method: 'post', body: data })
    },

    async revokeGroupInvite(groupId: number, inviteId: string) {
      return $api<{ ok: boolean }>(`/api/groups/${groupId}/invites/${inviteId}`, { method: 'delete' })
    },

    async redeemInvite(code: string) {
      return $api<{ ok: boolean, groupId: number }>('/api/groups/invites/redeem', { method: 'post', body: { code } })
    },

    // Notifications
    async getNotifications(params?: { limit?: number, before?: number }) {
      return $api<{ notifications: Notification[], nextCursor: number | null }>('/api/notifications', { params })
    },

    async getUnreadCount() {
      return $api<{ count: number }>('/api/notifications/unread-count')
    },

    async markNotificationsRead(data: { ids?: number[], all?: boolean }) {
      return $api<{ ok: boolean }>('/api/notifications/read', { method: 'patch', body: data })
    },

    // Push Notifications
    async subscribePush(subscription: { endpoint: string, keys: { auth: string, p256dh: string } }) {
      return $api<{ success: boolean }>('/api/notifications/subscribe', { method: 'post', body: subscription })
    },

    async unsubscribePush(endpoint: string) {
      return $api<{ success: boolean }>('/api/notifications/unsubscribe', { method: 'post', body: { endpoint } })
    },

    async getVapidPublicKey() {
      return $api<{ vapidPublicKey: string }>('/api/notifications/vapid-key')
    },

    // Version (health check)
    async getVersion() {
      return $api<{ version: string }>('/api/version')
    },

    // Moments
    async getMomentToday() {
      return $api<MomentState>('/api/moments/today')
    }
  }
}
