package org.kvj.sstack;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Handler;

import com.phonegap.api.PhonegapActivity;
import com.phonegap.api.Plugin;
import com.phonegap.api.PluginResult;
import com.phonegap.api.PluginResult.Status;

public class Quebec4Plugin extends Plugin {

	private static final String GET_TASKS_ACTION = "org.kvj.quebec4.action.GET_LIST";
	private static final String GET_TASKS_RESPONSE_ACTION = "org.kvj.quebec4.action.GET_LIST_RESP";
	private static final String GET_TASK_ACTION = "org.kvj.quebec4.action.GET";
	private static final String GET_TASK_RESPONSE_ACTION = "org.kvj.quebec4.action.GET_RESP";
	private static final String GOT_TASK_ACTION = "org.kvj.quebec4.action.GOT";
	private static final long OP_TIMEOUT = 2000;
	private Handler handler = null;

	public Quebec4Plugin() {
		super();
		handler = new Handler();
	}

	@Override
	public void setContext(PhonegapActivity ctx) {
		super.setContext(ctx);
		ctx.registerReceiver(getTaskReceiver, new IntentFilter(
				GET_TASK_RESPONSE_ACTION));
		ctx.registerReceiver(getTasksReceiver, new IntentFilter(
				GET_TASKS_RESPONSE_ACTION));
	}

	private BroadcastReceiver getTaskReceiver = new BroadcastReceiver() {

		@Override
		public void onReceive(Context context, Intent intent) {
			try {
				if (null != callback) {
					success(new PluginResult(Status.OK, new JSONObject(
							intent.getStringExtra("object"))), callback);
				}
			} catch (Exception e) {
				e.printStackTrace();
			}
		}

	};

	private BroadcastReceiver getTasksReceiver = new BroadcastReceiver() {

		@Override
		public void onReceive(Context context, Intent intent) {
			try {
				if (null != callback) {
					success(new PluginResult(Status.OK, new JSONArray(
							intent.getStringExtra("list"))), callback);
				}
			} catch (Exception e) {
				e.printStackTrace();
			}
		}

	};
	private String callback = null;

	@Override
	public boolean isSynch(String action) {
		if ("done".equals(action)) {
			return true;
		}
		return false;
	}

	@Override
	public PluginResult execute(String action, JSONArray params, String callback) {
		if ("list".equals(action)) {
			startTimeoutTimer(callback);
			ctx.sendBroadcast(new Intent(GET_TASKS_ACTION));
			return new PluginResult(Status.NO_RESULT);
		}
		if ("get".equals(action)) {
			Intent intent = new Intent(GET_TASK_ACTION);
			try {
				intent.putExtra("id", params.getInt(0));
			} catch (JSONException e) {
				e.printStackTrace();
			}
			startTimeoutTimer(callback);
			ctx.sendBroadcast(intent);
			return new PluginResult(Status.NO_RESULT);
		}
		if ("done".equals(action)) {
			Intent intent = new Intent(GOT_TASK_ACTION);
			try {
				intent.putExtra("id", params.getInt(0));
			} catch (JSONException e) {
				e.printStackTrace();
			}
			ctx.sendBroadcast(intent);
			return new PluginResult(Status.OK);
		}
		return new PluginResult(Status.INVALID_ACTION);
	}

	private void startTimeoutTimer(final String callback) {
		this.callback = callback;
		handler.postDelayed(new Runnable() {

			@Override
			public void run() {
				if (callback.equals(Quebec4Plugin.this.callback)) {
					Quebec4Plugin.this.callback = null;
					Quebec4Plugin.this.error("Timeout", callback);
				}
			}
		}, OP_TIMEOUT);
	}

	@Override
	public void onDestroy() {
		super.onDestroy();
		ctx.unregisterReceiver(getTaskReceiver);
		ctx.unregisterReceiver(getTasksReceiver);
	}

}
