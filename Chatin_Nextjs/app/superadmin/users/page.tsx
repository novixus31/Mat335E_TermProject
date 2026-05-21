'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { User, Plus, Pencil, CheckCircle2, XCircle, Trash2, Building2 } from 'lucide-react';
import { toast } from 'sonner';

interface Company {
  id: string;
  companyName: string;
}

interface UserData {
  id: string;
  userEmail: string;
  role: string;
  companyId: {
    _id: string;
    name: string;
  };
  companyName: string;
  createdAt: string;
}

export default function SuperAdminUsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<UserData[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editedRole, setEditedRole] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({
    userEmail: '',
    password: '',
    role: 'user',
    companyId: ''
  });
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');

  // Fetch all users
  useEffect(() => {
    async function fetchUsers() {
      if (!session?.user?.accessToken) return;

      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/api/users`, {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`
          }
        });

        const data = await response.json();
        if (data.success) {
          setUsers(data.users);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, [session]);

  // Fetch all companies for dropdown
  useEffect(() => {
    async function fetchCompanies() {
      if (!session?.user?.accessToken) return;

      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/api/companies`, {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`
          }
        });

        const data = await response.json();
        if (data.success) {
          setCompanies(data.companies);
        }
      } catch (error) {
        console.error('Error fetching companies:', error);
      }
    }

    fetchCompanies();
  }, [session]);

  // Add new user
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.userEmail.trim() || !newUser.password.trim() || !newUser.companyId || !session?.user?.accessToken) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.user.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newUser)
      });

      const data = await response.json();
      if (data.success) {
        setUsers([...users, data.user]);
        setNewUser({ userEmail: '', password: '', role: 'user', companyId: '' });
        setShowAddForm(false);
        toast.success('User created successfully');
      } else {
        toast.error(data.message || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Failed to create user');
    }
  };

  // Start editing user role
  const startEditing = (user: UserData) => {
    setEditingUserId(user.id);
    setEditedRole(user.role);
  };

  // Save edited user role
  const saveUserRole = async (userId: string) => {
    if (!editedRole || !session?.user?.accessToken) return;

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.user.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: editedRole })
      });

      const data = await response.json();
      if (data.success) {
        setUsers(users.map(u => u.id === userId ? { ...u, role: editedRole } : u));
        setEditingUserId(null);
        toast.success('User role updated successfully');
      } else {
        toast.error(data.message || 'Failed to update user role');
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Failed to update user role');
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingUserId(null);
    setEditedRole('');
  };

  // Delete user
  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    if (!session?.user?.accessToken) return;

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.user.accessToken}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setUsers(users.filter(u => u.id !== userId));
        toast.success('User deleted successfully');
      } else {
        toast.error(data.message || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesCompany = filterCompany === 'all' || user.companyId._id === filterCompany;
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesCompany && matchesRole;
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'bg-red-100 text-red-700';
      case 'admin':
        return 'bg-purple-100 text-purple-700';
      case 'manager':
        return 'bg-orange-100 text-orange-700';
      case 'user':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-1">Manage all users across all companies</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>

        {/* Add User Form */}
        {showAddForm && (
          <form onSubmit={handleAddUser} className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input
                type="email"
                value={newUser.userEmail}
                onChange={(e) => setNewUser({ ...newUser, userEmail: e.target.value })}
                placeholder="Email"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Password"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={newUser.companyId}
                onChange={(e) => setNewUser({ ...newUser, companyId: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select Company</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>{company.companyName}</option>
                ))}
              </select>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="user">User</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                Create User
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewUser({ userEmail: '', password: '', role: 'user', companyId: '' });
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Companies</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>{company.companyName}</option>
            ))}
          </select>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Roles</option>
            <option value="superadmin">Superadmin</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="user">User</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="text-sm font-medium text-gray-900">{user.userEmail}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Building2 className="w-4 h-4 text-gray-400 mr-2" />
                    <div className="text-sm text-gray-900">{user.companyName || 'N/A'}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingUserId === user.id ? (
                    <select
                      value={editedRole}
                      onChange={(e) => setEditedRole(e.target.value)}
                      className="px-3 py-1.5 border-2 border-indigo-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                      autoFocus
                    >
                      <option value="user">User</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                  ) : (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                      {user.role}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString('tr-TR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {editingUserId === user.id ? (
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => saveUserRole(user.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Save"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Cancel"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => startEditing(user)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit role"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No users found. {filterCompany !== 'all' || filterRole !== 'all' ? 'Try adjusting your filters.' : 'Click "Add User" to create one.'}
          </div>
        )}
      </div>
    </div>
  );
}
