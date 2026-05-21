import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, CheckCircle2, XCircle, UserPlus, Trash2, Power, PowerOff, X, User } from 'lucide-react';

interface Account {
  id: string;
  name: string;
  accountType: string;
  qrStatus: string;
  isActive: boolean;
  userId: {
    _id: string;
    userEmail: string;
    role: string;
  } | string;
  companyId: string;
  createdAt: string;
  companyOrder?: number;
}

interface User {
  id: string;
  userEmail: string;
  role: string;
}

interface SortableAccountRowProps {
  account: Account;
  index: number;
  editingAccount: string | null;
  editingName: string;
  assigningAccount: string | null;
  users: User[];
  onStartEdit: (id: string, name: string) => void;
  onSaveName: (id: string) => void;
  onCancelEdit: () => void;
  onToggleStatus: (id: string, status: boolean) => void;
  onDelete: (id: string) => void;
  onAssign: (accountId: string, userId: string) => void;
  onToggleAssigning: (id: string | null) => void;
  setEditingName: (name: string) => void;
  getStatusColor: (status: string) => string;
  getStatusText: (status: string) => string;
}

export default function SortableAccountRow({
  account,
  index,
  editingAccount,
  editingName,
  assigningAccount,
  users,
  onStartEdit,
  onSaveName,
  onCancelEdit,
  onToggleStatus,
  onDelete,
  onAssign,
  onToggleAssigning,
  setEditingName,
  getStatusColor,
  getStatusText,
}: SortableAccountRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: account.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={{
        ...style,
        height: '73px', // Fixed row height to prevent layout shift
      }}
      className={`hover:bg-gray-50 ${isDragging ? 'bg-indigo-50 shadow-lg' : ''} ${assigningAccount === account.id ? 'relative z-30' : ''}`}
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-indigo-600 touch-none p-1 hover:bg-gray-100 rounded transition-colors"
            title="Drag to reorder"
          >
            <GripVertical className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-indigo-600 min-w-[20px]">#{index + 1}</span>
        </div>
      </td>
      <td className="px-6 py-4">
        {editingAccount === account.id ? (
          <div className="flex items-center gap-2 relative z-10">
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveName(account.id);
                if (e.key === 'Escape') onCancelEdit();
              }}
              className="flex-1 px-3 py-2 text-sm font-medium border-2 border-indigo-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 bg-white shadow-sm min-w-[200px]"
              autoFocus
            />
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSaveName(account.id);
              }}
              className="flex-shrink-0 p-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
              title="Save"
            >
              <CheckCircle2 className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCancelEdit();
              }}
              className="flex-shrink-0 p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
              title="Cancel"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div>
              <div className="text-sm font-medium text-gray-900">{account.name}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">{account.accountType}</div>
            </div>
          </div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(account.qrStatus)} ring-2 ring-offset-1 ${
            account.qrStatus === 'connected' ? 'ring-green-200' :
            account.qrStatus === 'scanning' ? 'ring-yellow-200' : 'ring-red-200'
          }`}></span>
          <span className="text-sm font-medium text-gray-900">{getStatusText(account.qrStatus)}</span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStatus(account.id, account.isActive);
          }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            account.isActive
              ? 'bg-green-100 text-green-700 hover:bg-green-200 hover:shadow-sm'
              : 'bg-red-100 text-red-700 hover:bg-red-200 hover:shadow-sm'
          }`}
        >
          {account.isActive ? (
            <>
              <Power className="w-3.5 h-3.5" />
              Active
            </>
          ) : (
            <>
              <PowerOff className="w-3.5 h-3.5" />
              Inactive
            </>
          )}
        </button>
      </td>
      <td className="px-6 py-4 whitespace-nowrap relative" style={{ minWidth: '280px', width: '280px' }}>
        <div className="text-sm">
          {assigningAccount === account.id ? (
            <div className="absolute z-50 top-0 left-0 w-80 bg-white border border-indigo-200 rounded-xl shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-100 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-semibold text-gray-800">Assign to User</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleAssigning(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 hover:bg-white/50 p-1 rounded-lg transition-all"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* User List */}
              <div className="max-h-64 overflow-y-auto py-2">
                {users.filter(u => u.role === 'user').length > 0 ? (
                  users.filter(u => u.role === 'user').map((user) => {
                    const isSelected = typeof account.userId === 'object' && account.userId && account.userId._id === user.id;
                    return (
                      <button
                        key={user.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssign(account.id, user.id);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 transition-all group ${
                          isSelected
                            ? 'bg-indigo-100 hover:bg-indigo-100'
                            : 'hover:bg-indigo-50'
                        }`}
                      >
                        {/* User Icon */}
                        <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-gradient-to-br from-indigo-500 to-blue-500'
                            : 'bg-gradient-to-br from-indigo-100 to-blue-100 group-hover:from-indigo-200 group-hover:to-blue-200'
                        }`}>
                          <User className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-indigo-600'}`} />
                        </div>

                        {/* User Info */}
                        <div className="flex-1 text-left min-w-0">
                          <p className={`font-medium truncate text-sm ${
                            isSelected ? 'text-indigo-900' : 'text-gray-900'
                          }`}>
                            {user.userEmail}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              isSelected ? 'bg-blue-200 text-blue-800' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {user.role}
                            </span>
                          </div>
                        </div>

                        {/* Check indicator - always show for selected, show on hover for others */}
                        <div className={`flex-shrink-0 transition-opacity ${
                          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}>
                          <CheckCircle2 className={`w-5 h-5 ${
                            isSelected ? 'text-indigo-600 fill-indigo-600' : 'text-indigo-600'
                          }`} />
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-8 text-center text-gray-500">
                    <User className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No users with &apos;User&apos; role available</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Assigned User Display - Only show when dropdown is closed */
            <div>
              {typeof account.userId === 'object' && account.userId ? (
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate text-sm">{account.userId.userEmail}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      account.userId.role === 'admin'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {account.userId.role}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-400" />
                  </div>
                  <span className="italic text-sm">Unassigned</span>
                </div>
              )}
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {new Date(account.createdAt).toLocaleDateString('tr-TR')}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" style={{ minWidth: '150px', width: '150px' }}>
        <div className="flex items-center justify-end gap-1">
          {editingAccount !== account.id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartEdit(account.id, account.name);
              }}
              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Edit name"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleAssigning(assigningAccount === account.id ? null : account.id);
            }}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Assign user"
          >
            <UserPlus className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(account.id);
            }}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete account"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
