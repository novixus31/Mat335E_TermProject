'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Building2, Plus, Pencil, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Company {
  id: string;
  companyName: string;
  domain?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  _count?: {
    users: number;
    accounts: number;
  };
}

export default function SuperAdminPage() {
  const { data: session } = useSession();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');

  // Fetch all companies
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
      } finally {
        setLoading(false);
      }
    }

    fetchCompanies();
  }, [session]);

  // Add new company
  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim() || !session?.user?.accessToken) return;

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/companies`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.user.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ companyName: newCompanyName })
      });

      const data = await response.json();
      if (data.success) {
        // Add createdAt if not present (fallback to current date)
        const newCompany = {
          ...data.company,
          createdAt: data.company.createdAt || new Date().toISOString(),
          _count: { users: 0, accounts: 0 }
        };
        setCompanies([...companies, newCompany]);
        setNewCompanyName('');
        setShowAddForm(false);
        toast.success('Company created successfully');
      } else {
        toast.error(data.message || 'Failed to create company');
      }
    } catch (error) {
      console.error('Error creating company:', error);
      toast.error('Failed to create company');
    }
  };

  // Start editing company name
  const startEditing = (company: Company) => {
    setEditingCompanyId(company.id);
    setEditedName(company.companyName);
  };

  // Save edited company name
  const saveCompanyName = async (companyId: string) => {
    if (!editedName.trim() || !session?.user?.accessToken) return;

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/companies/${companyId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.user.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ companyName: editedName })
      });

      const data = await response.json();
      if (data.success) {
        setCompanies(companies.map(c => c.id === companyId ? { ...c, companyName: editedName } : c));
        setEditingCompanyId(null);
        toast.success('Company name updated successfully');
      } else {
        toast.error(data.message || 'Failed to update company name');
      }
    } catch (error) {
      console.error('Error updating company name:', error);
      toast.error('Failed to update company name');
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingCompanyId(null);
    setEditedName('');
  };

  // Delete company
  const handleDeleteCompany = async (companyId: string) => {
    if (!confirm('Are you sure you want to delete this company? This will delete all associated users and accounts.')) {
      return;
    }

    if (!session?.user?.accessToken) return;

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/companies/${companyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.user.accessToken}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setCompanies(companies.filter(c => c.id !== companyId));
        toast.success('Company deleted successfully');
      } else {
        toast.error(data.message || 'Failed to delete company');
      }
    } catch (error) {
      console.error('Error deleting company:', error);
      toast.error('Failed to delete company');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading companies...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Company Management</h1>
            <p className="text-gray-600 mt-1">Manage all companies in the system</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Company
          </button>
        </div>

        {/* Add Company Form */}
        {showAddForm && (
          <form onSubmit={handleAddCompany} className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Enter company name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewCompanyName('');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies.map((company) => (
          <div key={company.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-8 h-8 text-indigo-600" />
                {editingCompanyId === company.id ? (
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="text-xl font-bold text-gray-900 border-b-2 border-indigo-500 focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <h3 className="text-xl font-bold text-gray-900">{company.companyName}</h3>
                )}
              </div>
              <div className="flex items-center gap-1">
                {editingCompanyId === company.id ? (
                  <>
                    <button
                      onClick={() => saveCompanyName(company.id)}
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
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEditing(company)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Edit name"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCompany(company.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete company"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Users:</span>
                <span className="font-semibold text-gray-900">{company._count?.users || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Accounts:</span>
                <span className="font-semibold text-gray-900">{company._count?.accounts || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Created:</span>
                <span className="text-gray-500">
                  {new Date(company.createdAt).toLocaleDateString('tr-TR')}
                </span>
              </div>
            </div>
          </div>
        ))}

        {companies.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            No companies found. Click Add Company button to create one.
          </div>
        )}
      </div>
    </div>
  );
}
